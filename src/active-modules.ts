/**
 * Decodifica el JWT del usuario para obtener active_modules del tenant.
 * No verifica firma — solo lee el payload (el server MCP no tiene el secret).
 * Si no se puede leer o el campo no existe → null (significa "no filtrar").
 */

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

export function getActiveModulesFromJwt(token?: string | null): string[] | null {
  const t = token || process.env.SEMILLA_JWT_TOKEN || '';
  if (!t) return null;
  const payload = decodeJwtPayload(t);
  if (!payload) return null;
  const modules = payload.active_modules;
  if (!Array.isArray(modules)) return null;
  return modules.map((m) => String(m));
}

export function getActiveModulesFromEnv(): string[] | null {
  const raw = process.env.SEMILLA_ACTIVE_MODULES || '';
  if (!raw.trim()) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function resolveActiveModules(jwtToken?: string | null): string[] | null {
  return getActiveModulesFromEnv() ?? getActiveModulesFromJwt(jwtToken);
}
