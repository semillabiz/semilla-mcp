/**
 * Tools de clientes/contactos para Semilla MCP.
 * Endpoints: /api/semilla/partners
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate } from '../client.js';

export const customerTools: Tool[] = [
  {
    name: 'buscar_clientes',
    description:
      'Busca clientes, proveedores o contactos en Semilla por nombre, CUIT, email o teléfono. ' +
      'Devuelve datos de contacto, historial de compras y deuda pendiente.',
    annotations: { title: 'Buscar clientes', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Nombre, CUIT, email o teléfono del contacto',
        },
        tipo: {
          type: 'string',
          enum: ['todos', 'cliente', 'proveedor'],
          description: 'Tipo de contacto a buscar (default: todos)',
          default: 'todos',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 10)',
          default: 10,
        },
        offset: {
          type: 'number',
          description: 'Desplazamiento para paginación (default: 0)',
          default: 0,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_historial_cliente',
    description:
      'Obtiene el historial completo de un cliente: órdenes de venta, pagos, deuda pendiente ' +
      'y últimas interacciones.',
    annotations: { title: 'Historial de cliente', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: {
          type: 'string',
          description: 'UUID del cliente',
        },
        incluir_ordenes: {
          type: 'boolean',
          description: 'Incluir últimas órdenes de venta (default: true)',
          default: true,
        },
      },
      required: ['cliente_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleBuscarClientes(args: Record<string, unknown>) {
  const client = getClient();
  const query = String(args.query || '');
  const tipo = String(args.tipo || 'todos');
  const limit = Number(args.limit || 10);
  const offset = Number(args.offset || 0);

  const params: Record<string, string | number | boolean> = { search: query, limit, offset };
  if (tipo === 'cliente') params.is_customer = true;
  if (tipo === 'proveedor') params.is_supplier = true;

  try {
    const result = await client.get<unknown>('/api/semilla/partners', params);
    let contacts: Record<string, unknown>[] = [];

    if (Array.isArray(result)) {
      contacts = result as Record<string, unknown>[];
    } else if (result && typeof result === 'object' && 'data' in result) {
      contacts = ((result as Record<string, unknown>).data as Record<string, unknown>[]) || [];
    }

    if (!contacts.length) {
      return { content: [{ type: 'text', text: `No se encontraron contactos para "${query}".` }] };
    }

    const rows = contacts.map((c) => {
      const tags = [
        c.is_customer || c.customer_rank ? 'Cliente' : null,
        c.is_supplier || c.supplier_rank ? 'Proveedor' : null,
      ].filter(Boolean).join(' / ') || 'Contacto';

      return (
        `**${c.name}** (${tags})\n` +
        `  ID: \`${c.id}\`\n` +
        `  CUIT: ${c.vat || '—'} | Email: ${c.email || '—'} | Tel: ${c.phone || c.mobile || '—'}\n` +
        `  Ciudad: ${c.city || '—'}`
      );
    });

    let text = `## Contactos encontrados (${contacts.length})\n\n${rows.join('\n\n')}`;
    if (contacts.length >= limit) {
      text += `\n\n---\n_Mostrando ${contacts.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo buscar clientes: ${msg}.\nSi persiste, verificá tu sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}

export async function handleGetHistorialCliente(args: Record<string, unknown>) {
  const client = getClient();
  const clienteId = String(args.cliente_id);
  const incluirOrdenes = args.incluir_ordenes !== false;

  const [partnerResult, ordersResult] = await Promise.allSettled([
    client.get<unknown>(`/api/semilla/partners/${encodeURIComponent(clienteId)}`),
    incluirOrdenes
      ? client.get<unknown>('/api/semilla/sales/orders', { partner_id: clienteId, limit: 5, state: 'sale' })
      : Promise.resolve(null),
  ]);

  if (partnerResult.status === 'rejected') {
    return { content: [{ type: 'text', text: `No se encontró el cliente "${clienteId}".` }] };
  }

  const partner = ((partnerResult.value as Record<string, unknown>)?.data ?? partnerResult.value) as Record<string, unknown>;

  let ordersText = '';
  if (ordersResult.status === 'fulfilled' && ordersResult.value) {
    const raw = ordersResult.value as Record<string, unknown>;
    const orders: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw.data as Record<string, unknown>[]) || [];
    if (orders.length) {
      ordersText =
        '\n\n**Últimas órdenes:**\n' +
        orders.map((o) =>
          `- ${o.name} | ${formatDate(String(o.date_order || ''))} | ${formatCurrency(Number(o.amount_total || 0))} | ${o.state}`
        ).join('\n');
    }
  }

  const deuda = Number(partner.credit || partner.debit || 0);

  const text =
    `## Cliente: ${partner.name}\n\n` +
    `- **ID:** \`${partner.id}\`\n` +
    `- **CUIT:** ${partner.vat || '—'}\n` +
    `- **Email:** ${partner.email || '—'}\n` +
    `- **Teléfono:** ${partner.phone || partner.mobile || '—'}\n` +
    `- **Dirección:** ${[partner.street, partner.city, partner.state_id].filter(Boolean).join(', ') || '—'}\n` +
    `- **Deuda pendiente:** ${deuda ? formatCurrency(deuda) : '$0'}` +
    ordersText;

  return { content: [{ type: 'text', text }] };
}
