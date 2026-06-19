/**
 * HTTP client para llamar a la API de Semilla Connect (semilla-connect-shared).
 *
 * Connect-shared se autentica con `x-api-key` compartida + `x-user-id` del usuario
 * que ejecuta la acción. A diferencia del ERP (Bearer JWT), no hay sesión por
 * usuario: la API key es del servidor y el `x-user-id` identifica a quién
 * pertenecen los datos.
 *
 * Resolución del user_id:
 *   1. Argumento explícito de la tool (`user_id`).
 *   2. Variable de entorno `SEMILLA_CONNECT_USER_ID`.
 *   3. Claim `sub` o `user_id` decodificado del JWT del ERP (compartido entre Semilla y Connect).
 *
 * Resolución de tenant_id (opcional, solo profesionales con tenant):
 *   1. Argumento explícito (`tenant_id`).
 *   2. Variable de entorno `SEMILLA_CONNECT_TENANT_ID`.
 *   3. Claim `tenant_id` del JWT del ERP.
 *
 * Resolución de business_id (opcional, profesionales con varios negocios):
 *   1. Argumento explícito (`business_id`).
 *   2. Variable de entorno `SEMILLA_CONNECT_BUSINESS_ID`.
 */

import 'dotenv/config';
import { getClient as getErpClient } from './client.js';

const DEFAULT_CONNECT_URL = 'https://connect.semilla.biz';

export interface ConnectRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  /** Sobrescribe el user_id resuelto (caso multi-actor). */
  userId?: string;
  /** Sobrescribe el tenant_id resuelto. */
  tenantId?: string;
  /** Sobrescribe el business_id resuelto. */
  businessId?: string;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function resolveUserIdFromJwt(): string | null {
  const jwt = getErpClient().getJwtToken();
  if (!jwt) return null;
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  const v = payload.user_id || payload.sub || payload.userId;
  return v ? String(v) : null;
}

function resolveTenantIdFromJwt(): string | null {
  const jwt = getErpClient().getJwtToken();
  if (!jwt) return null;
  const payload = decodeJwtPayload(jwt);
  if (!payload) return null;
  const v = payload.tenant_id || payload.tenantId;
  return v ? String(v) : null;
}

export class ConnectClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.SEMILLA_CONNECT_URL || DEFAULT_CONNECT_URL).replace(/\/$/, '');
    this.apiKey = process.env.SEMILLA_CONNECT_API_KEY || process.env.CONNECT_API_KEY || '';
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }

  resolveUserId(explicit?: string): string {
    const fromArg = explicit && String(explicit).trim();
    if (fromArg) return fromArg;
    const fromEnv = (process.env.SEMILLA_CONNECT_USER_ID || '').trim();
    if (fromEnv) return fromEnv;
    const fromJwt = resolveUserIdFromJwt();
    if (fromJwt) return fromJwt;
    throw new Error(
      'No se pudo resolver el `user_id` del usuario. ' +
      'Pasalo como argumento `user_id`, o seteá SEMILLA_CONNECT_USER_ID en el entorno, ' +
      'o iniciá sesión en Semilla ERP con `iniciar_login_semilla`.'
    );
  }

  resolveTenantId(explicit?: string): string | null {
    const fromArg = explicit && String(explicit).trim();
    if (fromArg) return fromArg;
    const fromEnv = (process.env.SEMILLA_CONNECT_TENANT_ID || '').trim();
    if (fromEnv) return fromEnv;
    return resolveTenantIdFromJwt();
  }

  resolveBusinessId(explicit?: string): string | null {
    const fromArg = explicit && String(explicit).trim();
    if (fromArg) return fromArg;
    const fromEnv = (process.env.SEMILLA_CONNECT_BUSINESS_ID || '').trim();
    if (fromEnv) return fromEnv;
    return null;
  }

  async request<T = unknown>(path: string, options: ConnectRequestOptions = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error(
        'Falta SEMILLA_CONNECT_API_KEY (o CONNECT_API_KEY) en el entorno. ' +
        'Esta variable es la API key compartida del backend de Semilla Connect.'
      );
    }

    const { method = 'GET', params = {}, body, timeoutMs = 15_000 } = options;

    const userId = this.resolveUserId(options.userId);
    const tenantId = this.resolveTenantId(options.tenantId);
    const businessId = this.resolveBusinessId(options.businessId);

    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'x-user-id': userId,
    };
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (businessId) headers['x-business-id'] = businessId;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        let msg = `Connect ${res.status}`;
        try {
          const err = await res.json() as Record<string, unknown>;
          msg = String(err.error || err.message || msg);
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return res.json() as Promise<T>;
      }
      return (await res.text()) as unknown as T;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout al llamar a Connect ${path} (${timeoutMs}ms)`);
      }
      throw err;
    }
  }

  get<T = unknown>(path: string, opts: Omit<ConnectRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...opts, method: 'GET' });
  }

  post<T = unknown>(path: string, body: unknown, opts: Omit<ConnectRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...opts, method: 'POST', body });
  }

  put<T = unknown>(path: string, body: unknown, opts: Omit<ConnectRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...opts, method: 'PUT', body });
  }

  patch<T = unknown>(path: string, body: unknown, opts: Omit<ConnectRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...opts, method: 'PATCH', body });
  }

  del<T = unknown>(path: string, opts: Omit<ConnectRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(path, { ...opts, method: 'DELETE' });
  }
}

let _client: ConnectClient | null = null;

export function getConnectClient(): ConnectClient {
  if (!_client) _client = new ConnectClient();
  return _client;
}

/** Normaliza la respuesta del backend Connect: devuelve el payload "útil". */
export function unwrapConnect<T = unknown>(result: unknown): T {
  if (result == null) return result as T;
  if (Array.isArray(result)) return result as T;
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('data' in obj) return obj.data as T;
  }
  return result as T;
}

export function unwrapConnectArray<T = Record<string, unknown>>(result: unknown): T[] {
  const data = unwrapConnect<unknown>(result);
  if (Array.isArray(data)) return data as T[];
  // El backend a veces devuelve { items: [] }, { conversations: [] }, etc.
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['items', 'list', 'rows', 'records', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Helper: extrae el subobjeto pasado al input MCP para auth opcional. */
export function extractAuthOverrides(args: Record<string, unknown>): {
  userId?: string;
  tenantId?: string;
  businessId?: string;
} {
  return {
    userId: args.user_id ? String(args.user_id) : undefined,
    tenantId: args.tenant_id ? String(args.tenant_id) : undefined,
    businessId: args.business_id ? String(args.business_id) : undefined,
  };
}
