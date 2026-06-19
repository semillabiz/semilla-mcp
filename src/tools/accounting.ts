/**
 * Tools financieros/contables para Semilla MCP.
 * Endpoints: /api/semilla/accounting
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, getPeriodDates } from '../client.js';

export const accountingTools: Tool[] = [
  {
    name: 'get_facturas',
    description:
      'Lista facturas de clientes (ventas) o de proveedores (compras) con filtro de fecha. ' +
      'Ideal para responder "¿cuánto facturé?", "¿cuánto gasté?", "mostrá mis facturas de enero". ' +
      'Devuelve lista con totales y suma acumulada del período.',
    annotations: { title: 'Consultar facturas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['clientes', 'proveedores'],
          description: 'clientes = facturas emitidas (ingresos). proveedores = facturas recibidas (gastos). Default: clientes',
          default: 'clientes',
        },
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          description: 'Período predefinido. Ignorado si se usan desde/hasta.',
        },
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        estado: {
          type: 'string',
          enum: ['posted', 'draft', 'todas'],
          description: 'Estado de las facturas. Default: posted (solo confirmadas)',
          default: 'posted',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 50, máx: 200)',
          default: 50,
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
    name: 'get_resumen_financiero',
    description:
      'Resumen financiero del negocio: ingresos totales, gastos totales y resultado neto. ' +
      'Soporta período predefinido o rango libre con desde/hasta. ' +
      'Cuando el usuario pregunta "cuánto facturé este año", "cuánto gasté en enero", etc., usá esta tool.',
    annotations: { title: 'Resumen financiero', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: {
          type: 'string',
          enum: ['hoy', 'semana', 'mes', 'año'],
          description: 'Período predefinido (se ignora si se usan desde/hasta)',
          default: 'mes',
        },
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (alternativa a periodo)' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD (alternativa a periodo)' },
      },
      required: [],
    },
  },
  {
    name: 'get_facturas_pendientes',
    description:
      'Lista facturas de clientes sin cobrar (cuentas por cobrar) o facturas de proveedores ' +
      'sin pagar (cuentas por pagar).',
    annotations: { title: 'Consultar facturas pendientes', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['cobrar', 'pagar', 'todas'],
          description: 'Tipo de facturas a mostrar (default: todas)',
          default: 'todas',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 15)',
          default: 15,
        },
        offset: {
          type: 'number',
          description: 'Desplazamiento para paginación (default: 0)',
          default: 0,
        },
        vencidas: {
          type: 'boolean',
          description: 'Si true, solo muestra facturas vencidas',
          default: false,
        },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetFacturas(args: Record<string, unknown>) {
  const client = getClient();
  const tipo = String(args.tipo || 'clientes');
  const estado = String(args.estado || 'posted');
  const detailLimit = Math.min(Number(args.limit || 50), 200);
  const offset = Number(args.offset || 0);

  let desde: string;
  let hasta: string;
  if (args.desde && args.hasta) {
    desde = String(args.desde);
    hasta = String(args.hasta);
  } else {
    const periodo = String(args.periodo || 'mes');
    ({ desde, hasta } = getPeriodDates(periodo));
  }

  const moveType = tipo === 'proveedores' ? 'in_invoice' : 'out_invoice';
  const stateParam = estado !== 'todas' ? estado : undefined;

  try {
    const [summaryResult, listResult] = await Promise.allSettled([
      fetchSummary(client, moveType, desde, hasta, stateParam || 'posted'),
      client.get<unknown>('/api/semilla/accounting/moves', {
        move_type: moveType,
        date_from: desde,
        date_to: hasta,
        limit: detailLimit,
        offset,
        ...(stateParam ? { state: stateParam } : {}),
      }),
    ]);

    const summary = summaryResult.status === 'fulfilled'
      ? summaryResult.value
      : { total_amount: 0, pending_amount: 0, count: 0 };

    const listData = listResult.status === 'fulfilled'
      ? (listResult.value as Record<string, unknown>)
      : null;

    const moves: Record<string, unknown>[] = listData
      ? (Array.isArray(listData) ? listData as Record<string, unknown>[] : (listData?.data as Record<string, unknown>[]) || [])
      : [];

    if (summary.count === 0 && !moves.length) {
      return {
        content: [{
          type: 'text',
          text: `No hay facturas de ${tipo} en el período ${desde} → ${hasta}.`,
        }],
      };
    }

    const tipoLabel = tipo === 'proveedores' ? 'Proveedores (compras)' : 'Clientes (ventas)';

    const rows = moves.map((m) => {
      const nombre = String(m.partner_name || m.ref || '—');
      const fecha = String(m.invoice_date || m.date || '—');
      const monto = formatCurrency(Number(m.amount_total || 0));
      const num = String(m.name || m.ref || m.id);
      const pagado = m.payment_state === 'paid' ? '✓' : m.payment_state === 'in_payment' ? '~' : '○';
      return `| ${fecha} | ${num} | ${nombre} | ${monto} | ${pagado} |`;
    });

    let text =
      `## Facturas ${tipoLabel} — ${desde} → ${hasta}\n\n` +
      `| Métrica | Valor |\n|---|---|\n` +
      `| **Total facturado** | **${formatCurrency(summary.total_amount)}** |\n` +
      `| Pendiente de cobro | ${formatCurrency(summary.pending_amount)} |\n` +
      `| Total comprobantes | ${summary.count} |\n\n` +
      `> Total exacto calculado directamente en la base de datos.\n\n` +
      (rows.length > 0
        ? `### Últimos ${rows.length} comprobantes\n\n` +
          `| Fecha | Número | Cliente/Proveedor | Monto | Estado |\n` +
          `|---|---|---|---|---|\n` +
          rows.join('\n')
        : '');

    if (moves.length >= detailLimit) {
      text += `\n\n---\n_Mostrando ${moves.length} resultado(s). Usá \`offset: ${offset + detailLimit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudieron obtener las facturas: ${msg}.\nVerificá estar autenticado con \`login_semilla\` y que el período sea válido.` }],
      isError: true,
    };
  }
}

/** Llama al endpoint de aggregation SQL — un SELECT SUM sin paginar */
async function fetchSummary(
  client: ReturnType<typeof getClient>,
  moveType: string,
  desde: string,
  hasta: string,
  state = 'posted',
): Promise<{ total_amount: number; pending_amount: number; count: number }> {
  const result = await client.get<unknown>('/api/semilla/accounting/moves-summary', {
    move_type: moveType,
    date_from: desde,
    date_to: hasta,
    state,
  });
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;
  return {
    total_amount:   Number(data?.total_amount   || 0),
    pending_amount: Number(data?.pending_amount || 0),
    count:          Number(data?.count          || 0),
  };
}

export async function handleGetResumenFinanciero(args: Record<string, unknown>) {
  const client = getClient();

  let desde: string;
  let hasta: string;
  if (args.desde && args.hasta) {
    desde = String(args.desde);
    hasta = String(args.hasta);
  } else {
    const periodo = String(args.periodo || 'mes');
    ({ desde, hasta } = getPeriodDates(periodo));
  }

  const label = args.desde && args.hasta
    ? `${desde} → ${hasta}`
    : `${String(args.periodo || 'mes')} (${desde} → ${hasta})`;

  // Un único SELECT SUM por tipo — sin paginar, resultado exacto
  const [ingresosData, gastosData] = await Promise.all([
    fetchSummary(client, 'out_invoice', desde, hasta).catch(() => ({ total_amount: 0, pending_amount: 0, count: 0 })),
    fetchSummary(client, 'in_invoice',  desde, hasta).catch(() => ({ total_amount: 0, pending_amount: 0, count: 0 })),
  ]);

  const ingresos = ingresosData.total_amount;
  const gastos   = gastosData.total_amount;
  const resultado = ingresos - gastos;

  const text =
    `## Resumen Financiero — ${label}\n\n` +
    `| Concepto | Monto | Comprobantes |\n|---|---|---|\n` +
    `| **Ingresos** (facturas emitidas) | **${formatCurrency(ingresos)}** | ${ingresosData.count} |\n` +
    `| Pendiente de cobro | ${formatCurrency(ingresosData.pending_amount)} | — |\n` +
    `| **Gastos** (facturas recibidas) | **${formatCurrency(gastos)}** | ${gastosData.count} |\n` +
    `| **Resultado neto del período** | **${formatCurrency(resultado)}** | — |\n\n` +
    `> Total exacto calculado directamente en la base de datos (sin límite de paginación).`;

  return { content: [{ type: 'text', text }] };
}

export async function handleGetFacturasPendientes(args: Record<string, unknown>) {
  const client = getClient();
  const tipo = String(args.tipo || 'todas');
  const limit = Number(args.limit || 15);
  const offset = Number(args.offset || 0);
  const soloVencidas = Boolean(args.vencidas);

  const baseParams: Record<string, string | number | boolean> = { state: 'posted' };

  try {
    let invoices: Record<string, unknown>[] = [];

    if (tipo === 'cobrar' || tipo === 'todas') {
      const r = await client.get<unknown>('/api/semilla/accounting/moves', {
        ...baseParams, move_type: 'out_invoice',
      });
      const arr: Record<string, unknown>[] = Array.isArray(r)
        ? r as Record<string, unknown>[]
        : ((r as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];
      invoices.push(...arr.map((i) => ({ ...i, _tipo: 'cobrar' })));
    }

    if (tipo === 'pagar' || tipo === 'todas') {
      const r = await client.get<unknown>('/api/semilla/accounting/moves', {
        ...baseParams, move_type: 'in_invoice',
      });
      const arr: Record<string, unknown>[] = Array.isArray(r)
        ? r as Record<string, unknown>[]
        : ((r as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];
      invoices.push(...arr.map((i) => ({ ...i, _tipo: 'pagar' })));
    }

    invoices = invoices.filter((inv) => {
      const ps = String(inv.payment_state || '');
      return ps !== 'paid' && ps !== 'in_payment' && ps !== 'reversed';
    });

    if (soloVencidas) {
      const today = new Date().toISOString().split('T')[0];
      invoices = invoices.filter((inv) => {
        const due = String(inv.invoice_date_due || inv.date || '');
        return due && due < today;
      });
    }

    if (!invoices.length) {
      return {
        content: [{ type: 'text', text: `No hay facturas pendientes${soloVencidas ? ' vencidas' : ''}.` }],
      };
    }

    const total = invoices.reduce((s, i) => s + Number(i.amount_residual || i.amount_total || 0), 0);
    const paginated = invoices.slice(offset, offset + limit);

    const rows = paginated.map((inv) => {
      const emoji = inv._tipo === 'cobrar' ? '🔵' : '🔴';
      const venc = inv.invoice_date_due ? ` | vence ${inv.invoice_date_due}` : '';
      return (
        `${emoji} **${inv.name || inv.ref || inv.id}** | ` +
        `${inv.partner_name || '—'}${venc} | ` +
        `${formatCurrency(Number(inv.amount_residual || inv.amount_total || 0))}`
      );
    });

    let text =
      `## Facturas pendientes${soloVencidas ? ' (vencidas)' : ''}\n\n` +
      `**Total pendiente: ${formatCurrency(total)}**\n\n` +
      rows.join('\n');

    if (paginated.length >= limit) {
      text += `\n\n---\n_Mostrando ${paginated.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudieron obtener las facturas pendientes: ${msg}.\nVerificá estar autenticado con \`login_semilla\`.` }],
      isError: true,
    };
  }
}
