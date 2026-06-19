/**
 * Tools de Reportes Contables para Semilla MCP.
 * Endpoints: /api/semilla/accounting/reports
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, getPeriodDates, unwrap } from '../client.js';

export const accountingReportTools: Tool[] = [
  {
    name: 'get_libro_iva',
    description:
      'Libro IVA Ventas o Compras para un período. ' +
      'Devuelve líneas con CUIT, comprobante, neto, IVA y total.',
    annotations: { title: 'Libro IVA', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['ventas', 'compras'],
          description: 'Libro IVA Ventas o Compras',
        },
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          description: 'Período (default: mes)',
          default: 'mes',
        },
        desde: { type: 'string', description: 'YYYY-MM-DD (alternativa a periodo)' },
        hasta: { type: 'string', description: 'YYYY-MM-DD (alternativa a periodo)' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'get_libro_diario',
    description: 'Libro Diario contable para un período: todos los asientos en orden cronológico.',
    annotations: { title: 'Libro Diario', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          default: 'mes',
        },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'get_balance_sumas_saldos',
    description: 'Balance de Sumas y Saldos: por cuenta, débitos, créditos y saldo final del período.',
    annotations: { title: 'Balance de Sumas y Saldos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['mes', 'año'],
          default: 'año',
        },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
  {
    name: 'get_estado_resultados',
    description: 'Estado de Resultados (Pérdidas y Ganancias) del período.',
    annotations: { title: 'Estado de Resultados', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['mes', 'año'],
          default: 'año',
        },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

function resolverRango(args: Record<string, unknown>, defaultPeriodo = 'mes'): { desde: string; hasta: string } {
  if (args.desde && args.hasta) return { desde: String(args.desde), hasta: String(args.hasta) };
  return getPeriodDates(String(args.periodo || defaultPeriodo));
}

export async function handleGetLibroIva(args: Record<string, unknown>) {
  const client = getClient();
  const { desde, hasta } = resolverRango(args);
  const tipo = String(args.tipo);

  // Paths reales del ERP: /reports/libro-iva-ventas y /reports/libro-iva-compras
  const path = tipo === 'ventas'
    ? '/api/semilla/accounting/reports/libro-iva-ventas'
    : '/api/semilla/accounting/reports/libro-iva-compras';

  const result = await client.get<unknown>(path, { from: desde, to: hasta });
  const data = unwrap<unknown>(result);

  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];

  if (!rows.length) {
    return {
      content: [{
        type: 'text',
        text: `No hay comprobantes en el Libro IVA ${tipo} para ${desde} → ${hasta}.`,
      }],
    };
  }

  const totalNeto = rows.reduce((s, r) => s + Number(r.neto || r.base_imponible || 0), 0);
  const totalIva = rows.reduce((s, r) => s + Number(r.iva || r.monto_iva || 0), 0);
  const totalGeneral = rows.reduce((s, r) => s + Number(r.total || r.amount_total || 0), 0);

  const tableRows = rows.slice(0, 100).map((r) => {
    const fecha = String(r.invoice_date || r.fecha || '—');
    const num = String(r.name || r.numero || '—');
    const cuit = String(r.partner_cuit || r.cuit || '—');
    const nombre = String(r.partner_name || r.nombre || '—');
    const neto = Number(r.neto || r.base_imponible || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const iva = Number(r.iva || r.monto_iva || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const total = Number(r.total || r.amount_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    return `| ${fecha} | ${num} | ${cuit} | ${nombre} | ${neto} | ${iva} | ${total} |`;
  });

  const text =
    `## Libro IVA ${tipo === 'ventas' ? 'Ventas' : 'Compras'} — ${desde} → ${hasta}\n\n` +
    `**Totales:** Neto $${totalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | IVA $${totalIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })} | Total $${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n\n` +
    `| Fecha | Comprobante | CUIT | Razón Social | Neto | IVA | Total |\n` +
    `|---|---|---|---|---|---|---|\n` +
    tableRows.join('\n');

  return { content: [{ type: 'text', text }] };
}

export async function handleGetLibroDiario(args: Record<string, unknown>) {
  // El endpoint /reports/libro-diario del ERP devuelve PDF/XLSX, no JSON.
  // En su lugar, usamos /accounting/moves para obtener los asientos del período.
  const client = getClient();
  const { desde, hasta } = resolverRango(args);

  const result = await client.get<unknown>('/api/semilla/accounting/moves', {
    date_from: desde,
    date_to: hasta,
    state: 'posted',
    limit: 200,
  });
  const data = result as Record<string, unknown>;
  const moves: Record<string, unknown>[] = Array.isArray(data)
    ? data as Record<string, unknown>[]
    : (data?.data as Record<string, unknown>[]) || [];

  if (!moves.length) {
    return {
      content: [{ type: 'text', text: `No hay asientos contables posteados en ${desde} → ${hasta}.` }],
    };
  }

  const rows = moves.slice(0, 100).map((m) => {
    const fecha = String(m.date || m.invoice_date || '—');
    const ref = String(m.name || m.ref || m.id || '—');
    const diario = String(m.journal_name || m.journal_id || '—');
    const total = Number(m.amount_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    return `| ${fecha} | ${ref} | ${diario} | $${total} |`;
  });

  const text =
    `## Libro Diario — ${desde} → ${hasta}\n\n` +
    `(${moves.length} asientos)\n\n` +
    `| Fecha | Referencia | Diario | Total |\n` +
    `|---|---|---|---|\n` +
    rows.join('\n');

  return { content: [{ type: 'text', text }] };
}

export async function handleGetBalanceSumasSaldos(args: Record<string, unknown>) {
  const client = getClient();
  const { desde, hasta } = resolverRango(args, 'año');

  const result = await client.get<unknown>('/api/semilla/accounting/reports/trial-balance', { from: desde, to: hasta });
  const data = unwrap<unknown>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Balance Sumas y Saldos — ${desde} → ${hasta}\n\n` +
        '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    }],
  };
}

export async function handleGetEstadoResultados(args: Record<string, unknown>) {
  const client = getClient();
  const { desde, hasta } = resolverRango(args, 'año');

  const result = await client.get<unknown>('/api/semilla/accounting/reports/income-statement', { from: desde, to: hasta });
  const data = unwrap<unknown>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Estado de Resultados — ${desde} → ${hasta}\n\n` +
        '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    }],
  };
}
