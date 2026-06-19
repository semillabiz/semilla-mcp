/**
 * Tools de Point of Sale (POS) para Semilla MCP.
 * Endpoints: /api/semilla/pos
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate } from '../client.js';

export const posTools: Tool[] = [
  {
    name: 'get_sesiones_pos',
    description:
      'Lista las sesiones de caja del POS. Puede filtrar por estado (abierta/cerrada) ' +
      'y período. Muestra cajero, totales y estado de cada sesión.',
    annotations: { title: 'Consultar sesiones de caja', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['open', 'closed', 'todas'],
          description: 'Estado de las sesiones (default: todas)',
          default: 'todas',
        },
        limit: {
          type: 'number',
          description: 'Máximo de sesiones a mostrar (default: 10)',
          default: 10,
        },
        offset: {
          type: 'number',
          description: 'Desplazamiento para paginación (default: 0)',
          default: 0,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_sesion_pos',
    description:
      'Obtiene el detalle de la sesión de caja actualmente abierta, o de una sesión específica. ' +
      'Incluye totales de venta, cajero y estado.',
    annotations: { title: 'Consultar sesión de caja', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        sesion_id: {
          type: 'string',
          description: 'UUID de la sesión. Si no se provee, busca la sesión abierta actualmente.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ventas_pos',
    description:
      'Lista las órdenes de venta del POS para una sesión o el día de hoy. ' +
      'Incluye totales por método de pago (efectivo, tarjeta, etc.).',
    annotations: { title: 'Consultar ventas del POS', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        sesion_id: {
          type: 'string',
          description: 'UUID de la sesión. Si no se provee, usa la sesión abierta.',
        },
        limit: {
          type: 'number',
          description: 'Máximo de órdenes a mostrar (default: 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'resumen_cierre_pos',
    description:
      'Genera el resumen de arqueo de caja para una sesión POS: ventas por método de pago, ' +
      'totales, cantidad de transacciones. Útil para cierre de caja.',
    annotations: { title: 'Resumen de arqueo de caja', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        sesion_id: {
          type: 'string',
          description: 'UUID de la sesión a resumir. Si no se provee, usa la sesión abierta.',
        },
      },
      required: [],
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOpenSession(client: ReturnType<typeof getClient>): Promise<Record<string, unknown> | null> {
  const result = await client.get<unknown>('/api/semilla/pos/sessions', { state: 'open', limit: 1 });
  const arr: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];
  return arr[0] || null;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetSesionesPOS(args: Record<string, unknown>) {
  const client = getClient();
  const estado = String(args.estado || 'todas');
  const limit = Number(args.limit || 10);
  const offset = Number(args.offset || 0);

  const params: Record<string, string | number> = { limit, offset };
  if (estado !== 'todas') params.state = estado;

  try {
    const result = await client.get<unknown>('/api/semilla/pos/sessions', params);
    const sessions: Record<string, unknown>[] = Array.isArray(result)
      ? result as Record<string, unknown>[]
      : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

    if (!sessions.length) {
      return { content: [{ type: 'text', text: 'No hay sesiones de POS registradas.' }] };
    }

    const estadoEmoji = (s: string) => s === 'open' ? '🟢' : '⚫';
    const rows = sessions.map((s) =>
      `${estadoEmoji(String(s.state || ''))} **${s.name || s.id}** | ` +
      `${s.user_name || s.cashier || '—'} | ` +
      `Apertura: ${formatDate(String(s.start_at || s.opening_at || ''))} | ` +
      `Total: ${formatCurrency(Number(s.total_payments_amount || s.cash_total || 0))}`
    );

    let text = `## Sesiones POS\n\n${rows.join('\n')}`;
    if (sessions.length >= limit) {
      text += `\n\n---\n_Mostrando ${sessions.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudieron obtener las sesiones POS: ${msg}.\nSi persiste, verificá tu sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}

export async function handleGetSesionPOS(args: Record<string, unknown>) {
  const client = getClient();
  let session: Record<string, unknown> | null = null;

  if (args.sesion_id) {
    const result = await client.get<unknown>(`/api/semilla/pos/sessions/${args.sesion_id}`);
    session = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;
  } else {
    session = await getOpenSession(client);
  }

  if (!session) {
    return { content: [{ type: 'text', text: 'No hay sesión de POS abierta en este momento.' }] };
  }

  const text =
    `## Sesión POS: ${session.name || session.id}\n\n` +
    `- **Estado:** ${session.state === 'open' ? '🟢 Abierta' : '⚫ Cerrada'}\n` +
    `- **Cajero:** ${session.user_name || session.cashier || '—'}\n` +
    `- **Apertura:** ${formatDate(String(session.start_at || session.opening_at || ''))}\n` +
    `${session.stop_at ? `- **Cierre:** ${formatDate(String(session.stop_at))}\n` : ''}` +
    `- **Total ventas:** ${formatCurrency(Number(session.total_payments_amount || 0))}\n` +
    `- **Cantidad de órdenes:** ${session.order_count || '—'}`;

  return { content: [{ type: 'text', text }] };
}

export async function handleGetVentasPOS(args: Record<string, unknown>) {
  const client = getClient();
  const limit = Number(args.limit || 30);
  let sessionId = args.sesion_id ? String(args.sesion_id) : undefined;

  if (!sessionId) {
    const session = await getOpenSession(client);
    sessionId = session ? String(session.id) : undefined;
  }

  const params: Record<string, string | number> = { limit };
  if (sessionId) params.session_id = sessionId;

  const result = await client.get<unknown>('/api/semilla/pos/orders', params);
  const orders: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (!orders.length) {
    return { content: [{ type: 'text', text: 'No hay órdenes POS para esta sesión.' }] };
  }

  const total = orders.reduce((s, o) => s + Number(o.amount_total || 0), 0);

  const rows = orders.slice(0, limit).map((o) =>
    `- **${o.pos_reference || o.name || o.id}** | ` +
    `${o.partner_name || 'Consumidor final'} | ` +
    `${formatDate(String(o.date_order || ''))} | ` +
    `${formatCurrency(Number(o.amount_total || 0))}`
  );

  return {
    content: [{
      type: 'text',
      text:
        `## Ventas POS${sessionId ? ` (sesión ${sessionId})` : ''}\n\n` +
        `**Total: ${formatCurrency(total)} | Órdenes: ${orders.length}**\n\n` +
        rows.join('\n'),
    }],
  };
}

export async function handleResumenCierrePOS(args: Record<string, unknown>) {
  const client = getClient();
  let sessionId = args.sesion_id ? String(args.sesion_id) : undefined;

  if (!sessionId) {
    const session = await getOpenSession(client);
    sessionId = session ? String(session.id) : undefined;
  }

  if (!sessionId) {
    return { content: [{ type: 'text', text: 'No hay sesión de POS abierta para generar el resumen.' }] };
  }

  const result = await client.get<unknown>(`/api/semilla/pos/session/${sessionId}/summary`);
  const summary = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  const payments = (summary.payments || summary.payment_methods || []) as Record<string, unknown>[];
  const totalGeneral = Number(summary.total || summary.amount_total || 0);

  const paymentRows = payments.length
    ? payments.map((p) =>
        `| ${p.name || p.payment_method || '—'} | ${formatCurrency(Number(p.amount || 0))} |`
      ).join('\n')
    : '| (sin detalle) | — |';

  const text =
    `## Resumen Arqueo POS — Sesión ${sessionId}\n\n` +
    `**Total general: ${formatCurrency(totalGeneral)}**\n\n` +
    `### Por método de pago\n` +
    `| Método | Monto |\n|---|---|\n` +
    paymentRows;

  return { content: [{ type: 'text', text }] };
}
