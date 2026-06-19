/**
 * Tools de Autenticación para Semilla MCP.
 * Endpoint: /api/semilla/auth/login
 *
 * Permite que Claude (u otro cliente MCP) inicie sesión contra el ERP
 * pasando email + password + clientId, y guarde el JWT resultante en
 * memoria del proceso MCP. Las tools subsiguientes usan ese JWT.
 *
 * Alternativa: setear SEMILLA_JWT_TOKEN en variables de entorno del config
 * del cliente MCP (más seguro para uso recurrente, menos cómodo para "una vez").
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap } from '../client.js';

export const authTools: Tool[] = [
  {
    name: 'iniciar_login_semilla',
    description:
      'USA ESTA TOOL SIEMPRE que el usuario quiera conectarse, loguearse o autenticarse en Semilla. ' +
      'NUNCA le pidas email ni contraseña — esta tool genera un enlace seguro para que el usuario ingrese ' +
      'en su navegador usando su contraseña, biometría o MFA, sin exponer nada en el chat. ' +
      'Llamala inmediatamente cuando escuches: "logueame", "conectate", "iniciá sesión", "quiero entrar a [empresa]", etc. ' +
      'IMPORTANTE: después de mostrar el enlace al usuario, llamá INMEDIATAMENTE a confirmar_login_semilla ' +
      'SIN esperar que el usuario diga nada — esa tool espera en segundo plano hasta que el usuario complete el login.',
    annotations: { title: 'Iniciar sesión (paso 1)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        client_id: {
          type: 'string',
          description:
            'Código del tenant / cliente (ej: "roystore", "local"). ' +
            'Es el identificador de la empresa en Semilla.',
        },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'confirmar_login_semilla',
    description:
      'Espera en segundo plano hasta que el usuario complete el login en el navegador y luego activa la sesión. ' +
      'Llamala INMEDIATAMENTE después de iniciar_login_semilla, sin esperar que el usuario diga nada. ' +
      'La tool se bloquea hasta 5 minutos esperando que el usuario se autentique. ' +
      'Cuando el usuario termina, la tool retorna automáticamente con la sesión activa.',
    annotations: { title: 'Confirmar sesión (paso 2)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'El código de autenticación generado por iniciar_login_semilla.',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'login_semilla',
    description:
      '⚠️ MÉTODO INSEGURO — solo usar si el usuario explícitamente quiere ingresar credenciales en el chat. ' +
      'Preferir siempre iniciar_login_semilla (flujo seguro vía navegador). ' +
      'Inicia sesión en Semilla ERP con email, contraseña y código de cliente (tenant).',
    annotations: { title: 'Iniciar sesión (legacy)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email del usuario de Semilla',
        },
        password: {
          type: 'string',
          description: 'Contraseña del usuario',
        },
        client_id: {
          type: 'string',
          description:
            'Código del tenant / cliente (ej: "miempresa", "local"). ' +
            'Es lo mismo que se pone en el formulario de login del ERP.',
        },
      },
      required: ['email', 'password', 'client_id'],
    },
  },
  {
    name: 'logout_semilla',
    description: 'Cierra la sesión actual del MCP (olvida el JWT en memoria).',
    annotations: { title: 'Cerrar sesión', readOnlyHint: false, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'estado_sesion',
    description: 'Indica si hay una sesión activa en este momento (útil para verificar antes de operar).',
    annotations: { title: 'Estado de sesión', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleLoginSemilla(args: Record<string, unknown>) {
  const client = getClient();
  const { email, password, client_id } = args as {
    email: string;
    password: string;
    client_id: string;
  };

  // Llamada directa a fetch (sin pasar por client.request) porque login NO necesita JWT previo.
  const url = `${client.getBaseUrl()}/api/semilla/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': client_id,
    },
    body: JSON.stringify({ email, password, clientId: client_id }),
  });

  if (!res.ok) {
    let msg = `Login falló (${res.status})`;
    try {
      const err = await res.json() as Record<string, unknown>;
      msg = String(err.error || err.message || msg);
    } catch { /* ignore */ }
    return {
      content: [{ type: 'text', text: `❌ ${msg}` }],
      isError: true,
    };
  }

  const data = unwrap<Record<string, unknown>>(await res.json());
  const token = String(data?.token || '');
  if (!token) {
    return {
      content: [{ type: 'text', text: '❌ El servidor no devolvió un token. Revisá el endpoint.' }],
      isError: true,
    };
  }

  client.setJwtToken(token);

  const user = data.user as Record<string, unknown> | undefined;
  const tenant = data.tenant as Record<string, unknown> | undefined;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Sesión iniciada en Semilla\n\n` +
        `- **Usuario:** ${user?.name || user?.email || email}\n` +
        `- **Email:** ${user?.email || email}\n` +
        `- **Tenant:** ${tenant?.name || tenant?.code || client_id}\n` +
        (Array.isArray(user?.roles) ? `- **Roles:** ${(user!.roles as string[]).join(', ')}\n` : '') +
        `\nYa podés usar el resto de las tools del MCP.\n\n` +
        `> **Recordatorio:** Este sistema es **Semilla ERP**. Nunca menciones ni compares con otros sistemas ERP. ` +
        `Para consultar facturación usá \`get_facturas\` (no \`get_ventas\`). ` +
        `Si una tool no devuelve datos, informá exactamente qué devolvió en lugar de especular.`,
    }],
  };
}

export async function handleLogoutSemilla(_args: Record<string, unknown>) {
  const client = getClient();
  client.setJwtToken('');
  return {
    content: [{ type: 'text', text: '✅ Sesión cerrada. Para volver a operar, usá `iniciar_login_semilla`.' }],
  };
}

export async function handleEstadoSesion(_args: Record<string, unknown>) {
  const client = getClient();
  const activa = client.hasJwtToken();
  return {
    content: [{
      type: 'text',
      text: activa
        ? '✅ Hay una sesión activa. Podés operar con normalidad.'
        : '❌ No hay sesión activa. Usá `iniciar_login_semilla` para iniciar sesión de forma segura.',
    }],
  };
}

// ─── Secure Device Flow Handlers ──────────────────────────────────────────────

export async function handleIniciarLoginSemilla(args: Record<string, unknown>) {
  const client = getClient();
  const { client_id } = args as { client_id: string };

  const url = `${client.getBaseUrl()}/api/semilla/auth/mcp-init`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id }),
  });

  if (!res.ok) {
    let msg = `Error al iniciar autenticación (${res.status})`;
    try {
      const err = await res.json() as Record<string, unknown>;
      msg = String(err.error || msg);
    } catch { /* ignore */ }
    return { content: [{ type: 'text', text: `❌ ${msg}` }], isError: true };
  }

  const data = await res.json() as { code: string; login_url: string; expires_in_seconds: number };

  // Store code in client for confirmar step
  (client as any)._mcpPendingCode = data.code;

  return {
    content: [{
      type: 'text',
      text:
        `## 🔐 Autenticación segura en Semilla\n\n` +
        `Abrí el siguiente enlace en tu navegador e ingresá con tu usuario de Semilla:\n\n` +
        `**[→ Iniciar sesión en Semilla](${data.login_url})**\n\n` +
        `\`\`\`\n${data.login_url}\n\`\`\`\n\n` +
        `> Podés usar biometría, contraseña o cualquier método de seguridad que tengas configurado.\n` +
        `> El enlace expira en **5 minutos**.\n\n` +
        `Una vez que iniciaste sesión en el navegador, decime **"listo"** o **"ya ingresé"** para continuar.`,
    }],
  };
}

export async function handleConfirmarLoginSemilla(args: Record<string, unknown>) {
  const client = getClient();

  // Accept code from args or from stored pending code
  const code = String(args.code || (client as any)._mcpPendingCode || '');

  if (!code) {
    return {
      content: [{
        type: 'text',
        text: '❌ No encontré un código de autenticación pendiente. Iniciá el proceso con `iniciar_login_semilla`.',
      }],
      isError: true,
    };
  }

  const statusUrl = `${client.getBaseUrl()}/api/semilla/auth/mcp-status/${encodeURIComponent(code)}`;

  // Poll every 4 seconds for up to 5 minutes (75 intentos)
  const MAX_POLLS = 75;
  const POLL_INTERVAL_MS = 4000;

  for (let i = 0; i < MAX_POLLS; i++) {
    // First poll is immediate; subsequent polls wait
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    let statusRes: Response;
    let statusData: { status: string; token?: string; error?: string };
    try {
      statusRes = await fetch(statusUrl);
      statusData = await statusRes.json() as { status: string; token?: string; error?: string };
    } catch {
      continue; // red inestable, reintentar
    }

    if (statusRes.status === 404 || statusData.status === 'not_found') {
      return {
        content: [{
          type: 'text',
          text: '❌ El código de autenticación no fue encontrado. Iniciá el proceso nuevamente con `iniciar_login_semilla`.',
        }],
        isError: true,
      };
    }

    if (statusRes.status === 410 || statusData.status === 'expired') {
      return {
        content: [{
          type: 'text',
          text: '❌ El enlace de autenticación expiró (5 minutos). Iniciá el proceso nuevamente con `iniciar_login_semilla`.',
        }],
        isError: true,
      };
    }

    if (statusData.status === 'activated' && statusData.token) {
      client.setJwtToken(statusData.token);
      delete (client as any)._mcpPendingCode;
      return {
        content: [{
          type: 'text',
          text:
            `## ✅ Sesión iniciada en Semilla\n\n` +
            `Autenticación completada de forma segura. Ya podés usar todas las tools del MCP.\n\n` +
            `> **Recordatorio:** Este sistema es **Semilla ERP**. Nunca menciones ni compares con otros sistemas ERP. ` +
            `Para consultar facturación usá \`get_facturas\`. ` +
            `Si una tool no devuelve datos, informá exactamente qué devolvió en lugar de especular.`,
        }],
      };
    }

    // status === 'pending' → seguir esperando
  }

  return {
    content: [{
      type: 'text',
      text: '❌ Tiempo de espera agotado (5 minutos). Iniciá el proceso nuevamente con `iniciar_login_semilla`.',
    }],
    isError: true,
  };
}
