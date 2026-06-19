/**
 * Tools de contabilidad avanzada (escritura) para Semilla MCP.
 * Complementa accounting.ts (lectura). Endpoints: /api/semilla/accounting
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency } from '../client.js';

export const accountingWriteTools: Tool[] = [
  {
    name: 'get_diarios',
    description:
      'Lista los diarios contables del tenant: ventas, compras, banco, caja. ' +
      'Útil para saber el ID de diario antes de crear facturas o pagos.',
    annotations: { title: 'Consultar diarios contables', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['sale', 'purchase', 'bank', 'cash', 'todos'],
          description: 'Tipo de diario (default: todos)',
          default: 'todos',
        },
      },
      required: [],
    },
  },
  {
    name: 'crear_factura',
    description:
      'Crea una factura en borrador. Para facturas de cliente usá tipo "out_invoice", ' +
      'para facturas de proveedor usá "in_invoice".',
    annotations: { title: 'Crear factura', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['out_invoice', 'in_invoice', 'out_refund', 'in_refund'],
          description: 'Tipo: out_invoice=factura cliente, in_invoice=factura proveedor',
        },
        partner_id: {
          type: 'string',
          description: 'UUID del cliente o proveedor',
        },
        journal_id: {
          type: 'string',
          description: 'UUID del diario (opcional, usa el default del tipo)',
        },
        lineas: {
          type: 'array',
          description: 'Líneas de la factura',
          items: {
            type: 'object',
            properties: {
              producto_id: { type: 'string', description: 'UUID del producto' },
              descripcion: { type: 'string', description: 'Descripción de la línea' },
              cantidad: { type: 'number', description: 'Cantidad (default: 1)' },
              precio_unitario: { type: 'number', description: 'Precio unitario' },
              cuenta_id: { type: 'string', description: 'UUID de la cuenta contable (opcional)' },
            },
            required: ['precio_unitario'],
          },
        },
        fecha: {
          type: 'string',
          description: 'Fecha de la factura (YYYY-MM-DD, default: hoy)',
        },
        fecha_vencimiento: {
          type: 'string',
          description: 'Fecha de vencimiento (YYYY-MM-DD, opcional)',
        },
        referencia: {
          type: 'string',
          description: 'Referencia o número de factura del proveedor (opcional)',
        },
      },
      required: ['tipo', 'partner_id', 'lineas'],
    },
  },
  {
    name: 'postear_factura',
    description:
      'Confirma (postea) una factura en borrador. Después del posteo la factura queda ' +
      '"posted" y si hay ARCA configurado se dispara la autorización electrónica.',
    annotations: { title: 'Publicar factura', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        factura_id: {
          type: 'string',
          description: 'UUID de la factura a postear',
        },
      },
      required: ['factura_id'],
    },
  },
  {
    name: 'registrar_pago',
    description:
      'Registra el pago de una factura (total o parcial). Actualiza el estado de pago ' +
      'de la factura en el sistema.',
    annotations: { title: 'Registrar pago', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        factura_id: {
          type: 'string',
          description: 'UUID de la factura a pagar',
        },
        monto: {
          type: 'number',
          description: 'Monto del pago (si no se indica, paga el total pendiente)',
        },
        metodo_pago: {
          type: 'string',
          description: 'Método de pago (ej: "Efectivo", "Transferencia", "Tarjeta")',
        },
        journal_id: {
          type: 'string',
          description: 'UUID del diario de pago (banco/caja, opcional)',
        },
        fecha: {
          type: 'string',
          description: 'Fecha del pago (YYYY-MM-DD, default: hoy)',
        },
      },
      required: ['factura_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetDiarios(args: Record<string, unknown>) {
  const client = getClient();
  const tipo = String(args.tipo || 'todos');

  const params: Record<string, string> = {};
  if (tipo !== 'todos') params.type = tipo;

  const result = await client.get<unknown>('/api/semilla/accounting/journals', params);
  const journals: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (!journals.length) {
    return { content: [{ type: 'text', text: 'No se encontraron diarios contables.' }] };
  }

  const tipoLabel: Record<string, string> = {
    sale: '🔵 Ventas',
    purchase: '🟠 Compras',
    bank: '🏦 Banco',
    cash: '💵 Caja',
    general: '📒 General',
  };

  const rows = journals.map((j) => {
    const t = String(j.type || '');
    return `- **${tipoLabel[t] || t}** | \`${j.id}\` | ${j.name || j.code || '—'}`;
  });

  return {
    content: [{
      type: 'text',
      text: `## Diarios Contables\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleCrearFactura(args: Record<string, unknown>) {
  const client = getClient();
  const { tipo, partner_id, journal_id, lineas, fecha, fecha_vencimiento, referencia } = args as {
    tipo: string;
    partner_id: string;
    journal_id?: string;
    lineas: { producto_id?: string; descripcion?: string; cantidad?: number; precio_unitario: number; cuenta_id?: string }[];
    fecha?: string;
    fecha_vencimiento?: string;
    referencia?: string;
  };

  const body: Record<string, unknown> = {
    move_type: tipo,
    partner_id,
    invoice_line_ids: lineas.map((l) => {
      const line: Record<string, unknown> = {
        price_unit: l.precio_unitario,
        quantity: l.cantidad || 1,
      };
      if (l.producto_id) line.product_id = l.producto_id;
      if (l.descripcion) line.name = l.descripcion;
      if (l.cuenta_id) line.account_id = l.cuenta_id;
      return line;
    }),
  };
  if (journal_id) body.journal_id = journal_id;
  if (fecha) body.invoice_date = fecha;
  if (fecha_vencimiento) body.invoice_date_due = fecha_vencimiento;
  if (referencia) body.ref = referencia;

  try {
    const result = await client.post<unknown>('/api/semilla/accounting/moves', body);
    const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

    const tipoLabel: Record<string, string> = {
      out_invoice: 'Factura de cliente',
      in_invoice: 'Factura de proveedor',
      out_refund: 'Nota de crédito cliente',
      in_refund: 'Nota de crédito proveedor',
    };

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Factura creada (borrador)\n\n` +
          `- **Tipo:** ${tipoLabel[tipo] || tipo}\n` +
          `- **ID:** \`${data?.id || '—'}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Total:** ${formatCurrency(Number(data?.amount_total || 0))}\n` +
          `- **Estado:** ${data?.state || 'draft'}\n\n` +
          `Para confirmarla usá \`postear_factura\` con el ID.`,
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo crear la factura: ${msg}.\nVerificá que el cliente y los productos existan en el sistema.` }],
      isError: true,
    };
  }
}

export async function handlePostearFactura(args: Record<string, unknown>) {
  const client = getClient();
  const facturaId = String(args.factura_id);

  try {
    const result = await client.post<unknown>(`/api/semilla/accounting/moves/${facturaId}/post`, {});
    const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

    const cae = data?.cae || data?.arca_cae;

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Factura posteada\n\n` +
          `- **ID:** \`${facturaId}\`\n` +
          `- **Nombre:** ${data?.name || '—'}\n` +
          `- **Estado:** ${data?.state || 'posted'}\n` +
          `${cae ? `- **CAE (ARCA):** ${cae}\n` : ''}` +
          `- **Total:** ${formatCurrency(Number(data?.amount_total || 0))}`,
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo postear la factura: ${msg}.\nVerificá que el cliente y los productos existan en el sistema.` }],
      isError: true,
    };
  }
}

export async function handleRegistrarPago(args: Record<string, unknown>) {
  const client = getClient();
  const { factura_id, monto, metodo_pago, journal_id, fecha } = args as {
    factura_id: string;
    monto?: number;
    metodo_pago?: string;
    journal_id?: string;
    fecha?: string;
  };

  const body: Record<string, unknown> = {};
  if (monto) body.amount = monto;
  if (metodo_pago) body.payment_method = metodo_pago;
  if (journal_id) body.journal_id = journal_id;
  if (fecha) body.payment_date = fecha;

  const result = await client.post<unknown>(`/api/semilla/accounting/moves/${factura_id}/payments`, body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Pago registrado\n\n` +
        `- **Factura ID:** \`${factura_id}\`\n` +
        `- **Monto pagado:** ${formatCurrency(Number(data?.amount || monto || 0))}\n` +
        `- **Estado factura:** ${data?.payment_state || data?.state || '—'}`,
    }],
  };
}
