/**
 * Tools de ventas para Semilla MCP.
 * Endpoints: /api/semilla/sales/orders
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate, getPeriodDates } from '../client.js';

export const salesTools: Tool[] = [
  {
    name: 'get_ventas',
    description:
      'Consulta órdenes de venta de Semilla. Puede filtrar por período (hoy/semana/mes/año), ' +
      'estado (borrador/confirmada/cancelada) o cliente. Muestra total, cantidad y ticket promedio.',
    annotations: { title: 'Consultar ventas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          description: 'Período a consultar (default: hoy)',
          default: 'hoy',
        },
        estado: {
          type: 'string',
          enum: ['todas', 'draft', 'sale', 'done', 'cancel'],
          description: 'Estado de las órdenes (default: sale = confirmadas)',
          default: 'sale',
        },
        cliente: {
          type: 'string',
          description: 'Filtrar por nombre o ID del cliente',
        },
        limit: {
          type: 'number',
          description: 'Máximo de órdenes a mostrar (default: 20)',
          default: 20,
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
    name: 'get_orden_venta',
    description:
      'Obtiene el detalle completo de una orden de venta específica: cliente, líneas de productos, ' +
      'totales, estado y fecha.',
    annotations: { title: 'Detalle de orden de venta', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: {
          type: 'string',
          description: 'UUID o nombre de la orden (ej: S/00045)',
        },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'preview_crear_orden_venta',
    description:
      'PASO 1: Previsualiza una orden de venta antes de crearla. ' +
      'Muestra el detalle completo para que puedas confirmar. ' +
      'Después de revisar, usá confirmar_crear_orden_venta para ejecutarla.',
    annotations: { title: 'Vista previa: crear orden de venta', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        cliente_nombre: {
          type: 'string',
          description: 'Nombre del cliente',
        },
        cliente_id: {
          type: 'string',
          description: 'UUID del cliente (alternativa a cliente_nombre)',
        },
        lineas: {
          type: 'array',
          description: 'Líneas de la orden',
          items: {
            type: 'object',
            properties: {
              producto_nombre: { type: 'string', description: 'Nombre del producto' },
              producto_id: { type: 'string', description: 'UUID del producto' },
              cantidad: { type: 'number' },
              precio_unitario: { type: 'number' },
            },
            required: ['cantidad'],
          },
        },
        notas: { type: 'string', description: 'Notas internas (opcional)' },
      },
      required: ['lineas'],
    },
  },
  {
    name: 'confirmar_crear_orden_venta',
    description:
      'PASO 2: Crea efectivamente la orden de venta en el sistema. ' +
      'Usar SOLO después de haber ejecutado preview_crear_orden_venta y confirmado con el usuario.',
    annotations: { title: 'Crear orden de venta', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'UUID del cliente' },
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
        notas: { type: 'string' },
      },
      required: ['cliente_id', 'lineas'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetVentas(args: Record<string, unknown>) {
  const client = getClient();
  const periodo = String(args.periodo || 'hoy');
  const estado = String(args.estado || 'sale');
  const clienteFilter = args.cliente ? String(args.cliente) : undefined;
  const limit = Number(args.limit || 20);
  const offset = Number(args.offset || 0);

  const { desde, hasta } = getPeriodDates(periodo);

  const params: Record<string, string | number> = { limit, offset };
  if (estado !== 'todas') params.state = estado;
  if (clienteFilter) params.partner = clienteFilter;

  try {
    const result = await client.get<unknown>('/api/semilla/sales/orders', params);
    let orders: Record<string, unknown>[] = [];

    if (Array.isArray(result)) {
      orders = result as Record<string, unknown>[];
    } else if (result && typeof result === 'object' && 'data' in result) {
      orders = ((result as Record<string, unknown>).data as Record<string, unknown>[]) || [];
    }

    orders = orders.filter((o) => {
      const d = String(o.date_order || '').split('T')[0];
      return d >= desde && d <= hasta;
    });

    if (!orders.length) {
      return {
        content: [{
          type: 'text',
          text: `No hay órdenes de venta para el período: ${periodo} (${desde} → ${hasta}).`,
        }],
      };
    }

    const total = orders.reduce((s, o) => s + Number(o.amount_total || 0), 0);
    const promedio = total / orders.length;

    const lines = orders.slice(0, limit).map((o) => {
      const partnerObj = o.partner as Record<string, unknown> | undefined;
      return (
        `- **${o.name || o.id}** | ${formatDate(String(o.date_order))} | ` +
        `${o.partner_name || partnerObj?.name || '—'} | ` +
        `${formatCurrency(Number(o.amount_total || 0))} | ${o.state || '—'}`
      );
    });

    let text =
      `## Ventas — ${periodo} (${desde} → ${hasta})\n\n` +
      `| Total | Órdenes | Ticket promedio |\n|---|---|---|\n` +
      `| ${formatCurrency(total)} | ${orders.length} | ${formatCurrency(promedio)} |\n\n` +
      `**Órdenes:**\n${lines.join('\n')}`;

    if (orders.length >= limit) {
      text += `\n\n---\n_Mostrando ${orders.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudieron obtener las ventas: ${msg}.\nVerificá estar autenticado con \`login_semilla\` y que el período sea válido.` }],
      isError: true,
    };
  }
}

export async function handleGetOrdenVenta(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);

  const result = await client.get<unknown>(`/api/semilla/sales/orders/${encodeURIComponent(ordenId)}`);
  const rawOrder = (result as Record<string, unknown>)?.data ?? result;
  if (!rawOrder) {
    return { content: [{ type: 'text', text: `No se encontró la orden "${ordenId}".` }] };
  }

  const o = rawOrder as Record<string, unknown>;
  const lines: Record<string, unknown>[] = (o.lines || o.order_lines || []) as Record<string, unknown>[];

  const linesText = lines.length
    ? lines.map((l) =>
        `  - ${l.product_name || l.name || '—'} × ${l.quantity || l.product_uom_qty} @ ` +
        `${formatCurrency(Number(l.price_unit || 0))} = ${formatCurrency(Number(l.subtotal || l.price_subtotal || 0))}`
      ).join('\n')
    : '  (sin líneas)';

  const text =
    `## Orden: ${o.name || ordenId}\n\n` +
    `- **Cliente:** ${o.partner_name || '—'}\n` +
    `- **Fecha:** ${formatDate(String(o.date_order || ''))}\n` +
    `- **Estado:** ${o.state || '—'}\n` +
    `- **Total:** ${formatCurrency(Number(o.amount_total || 0))}\n\n` +
    `**Líneas:**\n${linesText}`;

  return { content: [{ type: 'text', text }] };
}

export async function handlePreviewCrearOrden(args: Record<string, unknown>) {
  // Solo formatea — no llama al ERP todavía
  const lineas = (args.lineas as Record<string, unknown>[]) || [];
  const total = lineas.reduce(
    (s, l) => s + Number(l.cantidad || 0) * Number(l.precio_unitario || 0),
    0
  );

  const linesText = lineas.map((l) =>
    `  - ${l.producto_nombre || l.producto_id || 'Producto'} × ${l.cantidad} @ ` +
    `${formatCurrency(Number(l.precio_unitario || 0))}`
  ).join('\n');

  const text =
    `## Preview — Nueva Orden de Venta\n\n` +
    `- **Cliente:** ${args.cliente_nombre || args.cliente_id || '—'}\n` +
    `${args.notas ? `- **Notas:** ${args.notas}\n` : ''}` +
    `\n**Líneas:**\n${linesText}\n\n` +
    `**Total estimado: ${formatCurrency(total)}**\n\n` +
    `---\n` +
    `⚠️ Esta es una previsualización. Para crear la orden en el sistema, ` +
    `usá \`confirmar_crear_orden_venta\` con los mismos datos.`;

  return { content: [{ type: 'text', text }] };
}

export async function handleConfirmarCrearOrden(args: Record<string, unknown>) {
  const client = getClient();
  const { cliente_id, lineas, notas } = args as {
    cliente_id: string;
    lineas: { producto_id: string; cantidad: number; precio_unitario?: number }[];
    notas?: string;
  };

  const body: Record<string, unknown> = {
    partner_id: cliente_id,
    lines: lineas.map((l) => ({
      product_id: l.producto_id,
      quantity: l.cantidad,
      price_unit: l.precio_unitario || 0,
    })),
  };
  if (notas) body.note = notas;

  const result = await client.post<unknown>('/api/semilla/sales/orders', body);
  const rawResult = (result as Record<string, unknown>)?.data ?? result;
  const order = rawResult as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Orden de venta creada\n\n` +
        `- **ID:** \`${order?.id || '—'}\`\n` +
        `- **Nombre:** ${order?.name || '—'}\n` +
        `- **Total:** ${formatCurrency(Number(order?.amount_total || 0))}\n` +
        `- **Estado:** ${order?.state || 'borrador'}\n\n` +
        `Podés confirmarla desde el ERP o usar el módulo de ventas.`,
    }],
  };
}
