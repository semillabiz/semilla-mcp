/**
 * HTTP client para llamar a la API de Semilla ERP.
 * Usa JWT del usuario (Authorization: Bearer) — acceso acotado al tenant del usuario.
 */

import 'dotenv/config';

// URL de producción del ERP — todos los clientes de Semilla usan esta misma URL.
// Se puede sobreescribir con SEMILLA_ERP_URL para desarrollo local o instancias self-hosted.
const DEFAULT_ERP_URL = 'https://semilla-erp-v-production.up.railway.app';

export interface ErpConfig {
  baseUrl: string;
  jwtToken: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
}

export class ErpClient {
  private config: ErpConfig;

  constructor(config?: Partial<ErpConfig>) {
    this.config = {
      baseUrl:  config?.baseUrl  || process.env.SEMILLA_ERP_URL   || DEFAULT_ERP_URL,
      jwtToken: config?.jwtToken || process.env.SEMILLA_JWT_TOKEN || '',
    };
    // jwtToken es opcional al construir — se puede setear vía setJwtToken()
    // (por ejemplo desde la tool `login_semilla`).
  }

  setJwtToken(token: string) {
    this.config.jwtToken = token;
  }

  hasJwtToken(): boolean {
    return Boolean(this.config.jwtToken);
  }

  getJwtToken(): string {
    return this.config.jwtToken;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', params = {}, body, timeoutMs = 15_000 } = options;

    if (!this.config.jwtToken) {
      throw new Error(
        'No hay sesión activa. Usá la tool `login_semilla` para iniciar sesión, ' +
        'o seteá SEMILLA_JWT_TOKEN como variable de entorno.'
      );
    }

    // Query string
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');

    const url = `${this.config.baseUrl}${path}${qs ? `?${qs}` : ''}`;

    const headers: Record<string, string> = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${this.config.jwtToken}`,
    };

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
        let msg = `ERP ${res.status}`;
        try {
          const err = await res.json() as Record<string, unknown>;
          msg = String(err.error || err.message || msg);
        } catch {}
        throw new Error(msg);
      }

      return res.json() as Promise<T>;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout al llamar a ${path} (${timeoutMs}ms)`);
      }
      throw err;
    }
  }

  // Shorthand helpers
  get<T = unknown>(path: string, params?: RequestOptions['params']) {
    return this.request<T>(path, { params });
  }

  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'POST', body });
  }

  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  /**
   * Descarga una imagen desde imageUrl y la sube al ERP vía multipart/form-data.
   * Usa el mismo endpoint POST pero sin JSON body.
   */
  async uploadImageFromUrl<T = unknown>(path: string, imageUrl: string, fieldName = 'image'): Promise<T> {
    // 1. Descargar la imagen desde la URL externa
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`No se pudo descargar la imagen (${imgRes.status}): ${imageUrl}`);
    }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();

    // 2. Armar FormData con el archivo
    const ext = contentType.includes('png') ? 'png'
      : contentType.includes('gif') ? 'gif'
      : contentType.includes('webp') ? 'webp'
      : 'jpg';
    const formData = new FormData();
    formData.append(fieldName, new Blob([buffer], { type: contentType }), `upload.${ext}`);

    // 3. Subir al ERP (no poner Content-Type manual — fetch lo pone con el boundary)
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.jwtToken}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        let msg = `ERP ${res.status}`;
        try {
          const err = await res.json() as Record<string, unknown>;
          msg = String(err.error || err.message || msg);
        } catch {}
        throw new Error(msg);
      }

      return res.json() as Promise<T>;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout al subir imagen a ${path}`);
      }
      throw err;
    }
  }
}

// ─── Singleton de conveniencia ────────────────────────────────────────────────

let _client: ErpClient | null = null;

export function getClient(): ErpClient {
  if (!_client) _client = new ErpClient();
  return _client;
}

// ─── Helpers de respuesta ─────────────────────────────────────────────────────

/**
 * Normaliza la respuesta del ERP. Devuelve siempre el payload "útil"
 * sin importar si el ERP respondió `{ success, data }`, un array pelado,
 * o un objeto suelto.
 */
export function unwrap<T = unknown>(result: unknown): T {
  if (result == null) return result as T;
  if (Array.isArray(result)) return result as T;
  if (typeof result === 'object' && 'data' in (result as Record<string, unknown>)) {
    return (result as Record<string, unknown>).data as T;
  }
  return result as T;
}

/**
 * Igual que unwrap pero garantizando un array de records.
 */
export function unwrapArray<T = Record<string, unknown>>(result: unknown): T[] {
  const data = unwrap<unknown>(result);
  if (Array.isArray(data)) return data as T[];
  return [];
}

// ─── Utilidades de formateo ───────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function getPeriodDates(periodo: string): { desde: string; hasta: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (periodo === 'hoy') {
    const t = fmt(now);
    return { desde: t, hasta: t };
  }
  if (periodo === 'semana') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    return { desde: fmt(monday), hasta: fmt(now) };
  }
  if (periodo === 'mes') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { desde: fmt(first), hasta: fmt(now) };
  }
  if (periodo === 'año') {
    const first = new Date(now.getFullYear(), 0, 1);
    return { desde: fmt(first), hasta: fmt(now) };
  }
  return { desde: fmt(now), hasta: fmt(now) };
}
