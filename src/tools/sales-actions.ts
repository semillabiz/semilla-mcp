/**
 * Tools de acciones sobre órdenes de venta para Semilla MCP.
 * Endpoints: /api/semilla/sales
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap } from '../client.js';

export const salesActionsTools: Tool[] = [
  {
    name: 'ventas_confirmar_orden',
    description:
      'Confirma una orden de venta (pasa de borrador a confirmada). ' +
      'Acción no reversible — el cliente queda comprometido.',
    annotations: { title: 'Confirmar orden de venta', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de venta' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'ventas_cancelar_orden',
    description: 'Cancela una orden de venta (solo si está en borrador o confirmada, no si ya tiene entregas).',
    annotations: { title: 'Cancelar orden de venta', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de venta' },
        motivo: { type: 'string', description: 'Motivo de la cancelación (opcional)' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'ventas_crear_entrega',
    description: 'Crea una entrega (remito) a partir de una orden de venta confirmada.',
    annotations: { title: 'Crear entrega (remito)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de venta' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'ventas_crear_factura_desde_orden',
    description: 'Crea una factura de venta a partir de una orden de venta (total o parcial).',
    annotations: { title: 'Crear factura desde orden de venta', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de venta' },
        tipo: {
          type: 'string',
          enum: ['factura_total', 'anticipo_porcentaje', 'anticipo_monto_fijo'],
          description: 'Tipo de facturación (default: factura_total)',
          default: 'factura_total',
        },
        monto: {
          type: 'number',
          description: 'Monto o porcentaje según tipo (solo para anticipo)',
        },
      },
      required: ['orden_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleVentasConfirmarOrden(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const result = await client.post<unknown>(
      `/api/semilla/sales/orders/${encodeURIComponent(ordenId)}/confirm`,
      {}
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Orden de venta confirmada\n\n` +
          `- **ID:** \`${ordenId}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || 'sale'}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al confirmar orden: ${(err as Error).message}. Verificá que la orden exista y esté en borrador.`,
      }],
      isError: true,
    };
  }
}

export async function handleVentasCancelarOrden(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const body: Record<string, unknown> = {};
    if (args.motivo) body.reason = args.motivo;

    const result = await client.post<unknown>(
      `/api/semilla/sales/orders/${encodeURIComponent(ordenId)}/cancel`,
      body
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Orden de venta cancelada\n\n` +
          `- **ID:** \`${ordenId}\`\n` +
          `- **Estado:** ${data?.state || 'cancel'}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al cancelar orden: ${(err as Error).message}. Verificá que la orden no tenga entregas pendientes.`,
      }],
      isError: true,
    };
  }
}

export async function handleVentasCrearEntrega(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const result = await client.post<unknown>(
      `/api/semilla/sales/orders/${encodeURIComponent(ordenId)}/delivery`,
      {}
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Entrega creada\n\n` +
          `- **Orden:** \`${ordenId}\`\n` +
          `- **Entrega ID:** \`${data?.id || '—'}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || '—'}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al crear entrega: ${(err as Error).message}. Verificá que la orden esté confirmada.`,
      }],
      isError: true,
    };
  }
}

export async function handleVentasCrearFacturaDesdeOrden(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const body: Record<string, unknown> = {
      advance_payment_method: args.tipo || 'factura_total',
    };
    if (args.monto) body.amount = args.monto;

    const result = await client.post<unknown>(
      `/api/semilla/sales/orders/${encodeURIComponent(ordenId)}/invoice`,
      body
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Factura creada desde orden\n\n` +
          `- **Orden:** \`${ordenId}\`\n` +
          `- **Factura ID:** \`${data?.id || '—'}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || 'draft'}\n\n` +
          `Para postear la factura usá \`postear_factura\` con ID \`${data?.id || '—'}\`.`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al crear factura: ${(err as Error).message}. Verificá que la orden esté confirmada y tenga productos facturables.`,
      }],
      isError: true,
    };
  }
}
