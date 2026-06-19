/**
 * Tools de inventario para Semilla MCP.
 * Endpoints: /api/semilla/stock
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate } from '../client.js';

export const inventoryTools: Tool[] = [
  {
    name: 'get_niveles_stock',
    description:
      'Consulta el stock actual de productos en los almacenes. Puede filtrar por producto, ' +
      'categoría o almacén. Más detallado que get_stock: incluye ubicación y lote.',
    annotations: { title: 'Consultar niveles de stock', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto: {
          type: 'string',
          description: 'Nombre o ID del producto (opcional)',
        },
        almacen: {
          type: 'string',
          description: 'Nombre o ID del almacén (opcional)',
        },
        solo_con_stock: {
          type: 'boolean',
          description: 'Si true, solo muestra productos con stock > 0 (default: true)',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 30)',
          default: 30,
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
    name: 'get_movimientos_stock',
    description:
      'Historial de movimientos de stock (entradas, salidas, transferencias) en un período. ' +
      'Permite ver el trazado de mercadería entre almacenes.',
    annotations: { title: 'Consultar movimientos de stock', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes'],
          description: 'Período de los movimientos (default: hoy)',
          default: 'hoy',
        },
        tipo: {
          type: 'string',
          enum: ['entrada', 'salida', 'transferencia', 'todos'],
          description: 'Tipo de movimiento (default: todos)',
          default: 'todos',
        },
        producto: {
          type: 'string',
          description: 'Filtrar por nombre o ID de producto (opcional)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de movimientos (default: 25)',
          default: 25,
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
    name: 'ajustar_stock',
    description:
      'Crea un ajuste de inventario para corregir el stock de un producto en un almacén. ' +
      'IMPORTANTE: Esta acción modifica el inventario real del ERP.',
    annotations: { title: 'Ajustar stock', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto a ajustar',
        },
        cantidad: {
          type: 'number',
          description: 'Nueva cantidad en stock (valor absoluto, no diferencia)',
        },
        almacen_id: {
          type: 'string',
          description: 'UUID del almacén (opcional, usa el default si no se provee)',
        },
        motivo: {
          type: 'string',
          description: 'Motivo del ajuste (ej: "Conteo físico", "Merma", "Error de registro")',
        },
      },
      required: ['producto_id', 'cantidad'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetNivelesStock(args: Record<string, unknown>) {
  const client = getClient();
  const limit = Number(args.limit || 30);
  const offset = Number(args.offset || 0);
  const soloConStock = args.solo_con_stock !== false;

  const params: Record<string, string | number | boolean> = { limit, offset };
  if (args.producto) params.product = String(args.producto);
  if (args.almacen) params.warehouse = String(args.almacen);
  if (soloConStock) params.with_stock = true;

  try {
    const result = await client.get<unknown>('/api/semilla/stock/quants', params);
    const quants: Record<string, unknown>[] = Array.isArray(result)
      ? result as Record<string, unknown>[]
      : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

    if (!quants.length) {
      return { content: [{ type: 'text', text: 'No se encontraron registros de stock con los filtros indicados.' }] };
    }

    const rows = quants.slice(0, limit).map((q) => {
      const qty = Number(q.quantity || q.qty || 0);
      const emoji = qty <= 0 ? '🔴' : qty < 5 ? '🟡' : '🟢';
      return (
        `${emoji} **${q.product_name || q.product_id || '—'}** | ` +
        `${q.location_name || q.warehouse_name || '—'} | ` +
        `Stock: **${qty}** ${q.uom || q.product_uom || 'u.'}`
      );
    });

    let text = `## Niveles de Stock\n\n${rows.join('\n')}`;
    if (quants.length >= limit) {
      text += `\n\n---\n_Mostrando ${quants.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo obtener el nivel de stock: ${msg}.\nSi persiste, verificá tu sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}

export async function handleGetMovimientosStock(args: Record<string, unknown>) {
  const client = getClient();
  const periodo = String(args.periodo || 'hoy');
  const tipo = String(args.tipo || 'todos');
  const limit = Number(args.limit || 25);
  const offset = Number(args.offset || 0);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmt(now);

  let desde = today;
  if (periodo === 'semana') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    desde = fmt(monday);
  } else if (periodo === 'mes') {
    desde = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  const params: Record<string, string | number> = { limit, offset, date_from: desde, date_to: today };
  if (args.producto) params.product = String(args.producto);
  if (tipo !== 'todos') params.type = tipo;

  try {
    const result = await client.get<unknown>('/api/semilla/stock/moves', params);
    const moves: Record<string, unknown>[] = Array.isArray(result)
      ? result as Record<string, unknown>[]
      : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

    if (!moves.length) {
      return { content: [{ type: 'text', text: `No hay movimientos de stock en el período: ${periodo} (${desde} → ${today}).` }] };
    }

    const tipoEmoji: Record<string, string> = { entrada: '📥', salida: '📤', transferencia: '🔄' };

    const rows = moves.slice(0, limit).map((m) => {
      const t = String(m.type || m.picking_type_code || 'todos');
      const emoji = tipoEmoji[t] || '📦';
      return (
        `${emoji} **${m.product_name || '—'}** | ` +
        `${formatDate(String(m.date || ''))} | ` +
        `Qty: ${m.quantity_done || m.qty_done || m.product_uom_qty || 0} | ` +
        `${m.origin || m.reference || '—'}`
      );
    });

    let text =
      `## Movimientos de Stock — ${periodo} (${desde} → ${today})\n\n` +
      `**Total: ${moves.length} movimientos**\n\n` +
      rows.join('\n');

    if (moves.length >= limit) {
      text += `\n\n---\n_Mostrando ${moves.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudieron obtener los movimientos de stock: ${msg}.\nSi persiste, verificá tu sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}

export async function handleAjustarStock(args: Record<string, unknown>) {
  const client = getClient();
  const { producto_id, cantidad, almacen_id, motivo } = args as {
    producto_id: string;
    cantidad: number;
    almacen_id?: string;
    motivo?: string;
  };

  const body: Record<string, unknown> = {
    product_id: producto_id,
    quantity: cantidad,
  };
  if (almacen_id) body.location_id = almacen_id;
  if (motivo) body.reason = motivo;

  const result = await client.post<unknown>('/api/semilla/stock/adjustments', body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Ajuste de stock creado\n\n` +
        `- **Producto ID:** \`${producto_id}\`\n` +
        `- **Nueva cantidad:** ${cantidad}\n` +
        `${almacen_id ? `- **Almacén:** \`${almacen_id}\`\n` : ''}` +
        `${motivo ? `- **Motivo:** ${motivo}\n` : ''}` +
        `- **ID del ajuste:** \`${data?.id || '—'}\``,
    }],
  };
}
