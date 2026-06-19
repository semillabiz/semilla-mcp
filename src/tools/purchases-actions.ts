/**
 * Tools de acciones sobre órdenes de compra para Semilla MCP.
 * Endpoints: /api/semilla/purchases
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap } from '../client.js';

export const purchasesActionsTools: Tool[] = [
  {
    name: 'compras_confirmar_orden',
    description:
      'Confirma una orden de compra (pasa de borrador a confirmada). ' +
      'Envía el pedido al proveedor.',
    annotations: { title: 'Confirmar orden de compra', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de compra' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'compras_cancelar_orden',
    description: 'Cancela una orden de compra (solo si no tiene recepciones procesadas).',
    annotations: { title: 'Cancelar orden de compra', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de compra' },
        motivo: { type: 'string', description: 'Motivo de la cancelación (opcional)' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'compras_crear_recepcion',
    description: 'Crea una recepción de mercadería a partir de una orden de compra confirmada.',
    annotations: { title: 'Crear recepción de mercadería', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de compra' },
      },
      required: ['orden_id'],
    },
  },
  {
    name: 'compras_crear_factura_proveedor',
    description: 'Crea una factura de proveedor (in_invoice) a partir de una orden de compra.',
    annotations: { title: 'Crear factura de proveedor', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        orden_id: { type: 'string', description: 'UUID de la orden de compra' },
      },
      required: ['orden_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleComprasConfirmarOrden(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const result = await client.post<unknown>(
      `/api/semilla/purchases/orders/${encodeURIComponent(ordenId)}/confirm`,
      {}
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Orden de compra confirmada\n\n` +
          `- **ID:** \`${ordenId}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || 'purchase'}`,
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

export async function handleComprasCancelarOrden(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const body: Record<string, unknown> = {};
    if (args.motivo) body.reason = args.motivo;

    const result = await client.post<unknown>(
      `/api/semilla/purchases/orders/${encodeURIComponent(ordenId)}/cancel`,
      body
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Orden de compra cancelada\n\n` +
          `- **ID:** \`${ordenId}\`\n` +
          `- **Estado:** ${data?.state || 'cancel'}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al cancelar orden: ${(err as Error).message}. Verificá que no tenga recepciones procesadas.`,
      }],
      isError: true,
    };
  }
}

export async function handleComprasCrearRecepcion(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const result = await client.post<unknown>(
      `/api/semilla/purchases/orders/${encodeURIComponent(ordenId)}/receipt`,
      {}
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Recepción creada\n\n` +
          `- **Orden:** \`${ordenId}\`\n` +
          `- **Recepción ID:** \`${data?.id || '—'}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || '—'}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al crear recepción: ${(err as Error).message}. Verificá que la orden esté confirmada.`,
      }],
      isError: true,
    };
  }
}

export async function handleComprasCrearFacturaProveedor(args: Record<string, unknown>) {
  const client = getClient();
  const ordenId = String(args.orden_id);
  try {
    const result = await client.post<unknown>(
      `/api/semilla/purchases/orders/${encodeURIComponent(ordenId)}/invoice`,
      {}
    );
    const data = unwrap<Record<string, unknown>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Factura de proveedor creada\n\n` +
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
        text: `❌ Error al crear factura: ${(err as Error).message}. Verificá que la orden esté confirmada.`,
      }],
      isError: true,
    };
  }
}
