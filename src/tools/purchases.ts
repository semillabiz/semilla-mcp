/**
 * Tools de compras para Semilla MCP.
 * Endpoints: /api/semilla/purchases
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate, getPeriodDates } from '../client.js';

export const purchaseTools: Tool[] = [
  {
    name: 'get_ordenes_compra',
    description:
      'Lista las órdenes de compra. Filtra por estado, proveedor o período. ' +
      'Muestra proveedor, total y fecha esperada de recepción.',
    annotations: { title: 'Consultar órdenes de compra', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          description: 'Período (default: mes)',
          default: 'mes',
        },
        estado: {
          type: 'string',
          enum: ['todas', 'draft', 'purchase', 'done', 'cancel'],
          description: 'Estado (draft=borrador, purchase=confirmada, done=recibida, default: todas)',
          default: 'todas',
        },
        proveedor: {
          type: 'string',
          description: 'Filtrar por nombre del proveedor (opcional)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de órdenes (default: 20)',
          default: 20,
        },
        offset: {
          type: 'number',
          description: 'Número de órdenes a omitir (para paginación, default: 0)',
          default: 0,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_orden_compra',
    description: 'Detalle completo de una orden de compra: proveedor, líneas, totales y estado.',
    annotations: { title: 'Detalle de orden de compra', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: {
          type: 'string',
          description: 'UUID o nombre de la orden (ej: PO/00012)',
        },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'preview_crear_orden_compra',
    description:
      'PASO 1: Previsualiza una orden de compra antes de crearla. ' +
      'Muestra el detalle para confirmar. Después usar confirmar_crear_orden_compra.',
    annotations: { title: 'Vista previa: crear orden de compra', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        proveedor_nombre: {
          type: 'string',
          description: 'Nombre del proveedor',
        },
        proveedor_id: {
          type: 'string',
          description: 'UUID del proveedor (alternativa a proveedor_nombre)',
        },
        lineas: {
          type: 'array',
          description: 'Líneas de la orden de compra',
          items: {
            type: 'object',
            properties: {
              producto_nombre: { type: 'string' },
              producto_id: { type: 'string' },
              cantidad: { type: 'number' },
              precio_unitario: { type: 'number' },
            },
            required: ['cantidad'],
          },
        },
        fecha_entrega: {
          type: 'string',
          description: 'Fecha de entrega esperada (YYYY-MM-DD, opcional)',
        },
        notas: { type: 'string', description: 'Notas internas (opcional)' },
      },
      required: ['lineas'],
    },
  },
  {
    name: 'confirmar_crear_orden_compra',
    description:
      'PASO 2: Crea efectivamente la orden de compra. ' +
      'Usar SOLO después de preview_crear_orden_compra y confirmación del usuario.',
    annotations: { title: 'Crear orden de compra', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        proveedor_id: { type: 'string', description: 'UUID del proveedor' },
        lineas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              producto_id: { type: 'string' },
              cantidad: { type: 'number' },
              precio_unitario: { type: 'number' },
            },
            required: ['producto_id', 'cantidad'],
          },
        },
        fecha_entrega: { type: 'string', description: 'Fecha de entrega esperada (YYYY-MM-DD)' },
        notas: { type: 'string' },
      },
      required: ['proveedor_id', 'lineas'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetOrdenesCompra(args: Record<string, unknown>) {
  const client = getClient();
  const periodo = String(args.periodo || 'mes');
  const estado = String(args.estado || 'todas');
  const limit = Number(args.limit || 20);
  const offset = Number(args.offset || 0);
  const { desde, hasta } = getPeriodDates(periodo);

  const params: Record<string, string | number> = { limit };
  if (estado !== 'todas') params.state = estado;
  if (args.proveedor) params.partner = String(args.proveedor);

  try {
    const result = await client.get<unknown>('/api/semilla/purchases/orders', params);
    let orders: Record<string, unknown>[] = Array.isArray(result)
      ? result as Record<string, unknown>[]
      : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

    orders = orders.filter((o) => {
      const d = String(o.date_order || o.date_approve || '').split('T')[0];
      return !d || (d >= desde && d <= hasta);
    });

    if (!orders.length) {
      return { content: [{ type: 'text', text: `No hay órdenes de compra para el período: ${periodo}.` }] };
    }

    const total = orders.reduce((s, o) => s + Number(o.amount_total || 0), 0);
    const page = orders.slice(offset, offset + limit);

    const rows = page.map((o) =>
      `- **${o.name || o.id}** | ` +
      `${o.partner_name || '—'} | ` +
      `${formatDate(String(o.date_order || ''))} | ` +
      `${formatCurrency(Number(o.amount_total || 0))} | ${o.state || '—'}`
    );

    const footer = page.length >= limit
      ? `\n\n---\n_Mostrando ${page.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`
      : '';

    return {
      content: [{
        type: 'text',
        text:
          `## Órdenes de Compra — ${periodo} (${desde} → ${hasta})\n\n` +
          `**Total: ${formatCurrency(total)} | Órdenes: ${orders.length}**\n\n` +
          rows.join('\n') +
          footer,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al obtener órdenes de compra: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}

export async function handleGetOrdenCompra(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);

  const result = await client.get<unknown>(`/api/semilla/purchases/orders/${encodeURIComponent(ordenId)}`);
  const rawOrder = (result as Record<string, unknown>)?.data ?? result;
  if (!rawOrder) {
    return { content: [{ type: 'text', text: `No se encontró la orden "${ordenId}".` }] };
  }

  const o = rawOrder as Record<string, unknown>;
  const lines: Record<string, unknown>[] = (o.lines || o.order_lines || []) as Record<string, unknown>[];

  const linesText = lines.length
    ? lines.map((l) =>
        `  - ${l.product_name || l.name || '—'} × ${l.quantity || l.product_qty} @ ` +
        `${formatCurrency(Number(l.price_unit || 0))} = ${formatCurrency(Number(l.subtotal || l.price_subtotal || 0))}`
      ).join('\n')
    : '  (sin líneas)';

  const text =
    `## Orden de Compra: ${o.name || ordenId}\n\n` +
    `- **Proveedor:** ${o.partner_name || '—'}\n` +
    `- **Fecha:** ${formatDate(String(o.date_order || ''))}\n` +
    `- **Fecha entrega:** ${formatDate(String(o.date_planned || ''))}\n` +
    `- **Estado:** ${o.state || '—'}\n` +
    `- **Total:** ${formatCurrency(Number(o.amount_total || 0))}\n\n` +
    `**Líneas:**\n${linesText}`;

  return { content: [{ type: 'text', text }] };
}

export async function handlePreviewCrearOrdenCompra(args: Record<string, unknown>) {
  const lineas = (args.lineas as Record<string, unknown>[]) || [];
  const total = lineas.reduce(
    (s, l) => s + Number(l.cantidad || 0) * Number(l.precio_unitario || 0),
    0
  );

  const linesText = lineas.map((l) =>
    `  - ${l.producto_nombre || l.producto_id || 'Producto'} × ${l.cantidad} @ ` +
    `${formatCurrency(Number(l.precio_unitario || 0))}`
  ).join('\n');

  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nueva Orden de Compra\n\n` +
        `- **Proveedor:** ${args.proveedor_nombre || args.proveedor_id || '—'}\n` +
        `${args.fecha_entrega ? `- **Fecha entrega:** ${args.fecha_entrega}\n` : ''}` +
        `${args.notas ? `- **Notas:** ${args.notas}\n` : ''}` +
        `\n**Líneas:**\n${linesText}\n\n` +
        `**Total estimado: ${formatCurrency(total)}**\n\n` +
        `---\n` +
        `⚠️ Esta es una previsualización. Para crear la OC, usá \`confirmar_crear_orden_compra\`.`,
    }],
  };
}

export async function handleConfirmarCrearOrdenCompra(args: Record<string, unknown>) {
  const client = getClient();
  const { proveedor_id, lineas, fecha_entrega, notas } = args as {
    proveedor_id: string;
    lineas: { producto_id: string; cantidad: number; precio_unitario?: number }[];
    fecha_entrega?: string;
    notas?: string;
  };

  const body: Record<string, unknown> = {
    partner_id: proveedor_id,
    lines: lineas.map((l) => ({
      product_id: l.producto_id,
      quantity: l.cantidad,
      price_unit: l.precio_unitario || 0,
    })),
  };
  if (fecha_entrega) body.date_planned = fecha_entrega;
  if (notas) body.notes = notas;

  const result = await client.post<unknown>('/api/semilla/purchases/orders', body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Orden de compra creada\n\n` +
        `- **ID:** \`${data?.id || '—'}\`\n` +
        `- **Nombre:** ${data?.name || '—'}\n` +
        `- **Total:** ${formatCurrency(Number(data?.amount_total || 0))}\n` +
        `- **Estado:** ${data?.state || 'borrador'}`,
    }],
  };
}
