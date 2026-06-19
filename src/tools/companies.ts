/**
 * Tools de Empresas y Sucursales para Semilla MCP.
 * Endpoints: /api/semilla/companies, /api/semilla/branches
 *
 * Solo lectura — la gestión de empresas se hace desde la app web.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap, unwrapArray } from '../client.js';

export const companyTools: Tool[] = [
  {
    name: 'listar_empresas',
    description: 'Lista las empresas del tenant (un tenant puede tener múltiples empresas / razones sociales).',
    annotations: { title: 'Listar empresas', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_empresa',
    description: 'Detalle de una empresa: razón social, CUIT, condición IVA, dirección, datos fiscales.',
    annotations: { title: 'Ver empresa', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empresa_id: { type: 'string', description: 'UUID de la empresa' },
      },
      required: ['empresa_id'],
    },
  },
  {
    name: 'listar_sucursales',
    description: 'Lista sucursales de una empresa (puntos de venta físicos).',
    annotations: { title: 'Listar sucursales', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empresa_id: { type: 'string', description: 'Filtrar por empresa (opcional)' },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleListarEmpresas(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/companies');
  const empresas = unwrapArray(result);

  if (!empresas.length) return { content: [{ type: 'text', text: 'No hay empresas.' }] };

  const rows = empresas.map((e) =>
    `- **${e.name || e.legal_name}** | CUIT: ${e.cuit || e.tax_id || '—'} | \`${e.id}\``
  );

  return { content: [{ type: 'text', text: `## Empresas (${empresas.length})\n\n${rows.join('\n')}` }] };
}

export async function handleGetEmpresa(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.empresa_id);
  const result = await client.get<unknown>(`/api/semilla/companies/${encodeURIComponent(id)}`);
  const e = unwrap<Record<string, unknown>>(result);
  if (!e) return { content: [{ type: 'text', text: `No se encontró la empresa ${id}.` }] };

  return {
    content: [{
      type: 'text',
      text:
        `## Empresa: ${e.name || e.legal_name}\n\n` +
        `- **Razón social:** ${e.legal_name || e.name}\n` +
        `- **CUIT:** ${e.cuit || e.tax_id || '—'}\n` +
        `- **Condición IVA:** ${e.iva_condition || e.tax_condition || '—'}\n` +
        `- **Dirección:** ${e.address || '—'}\n` +
        `- **Ciudad:** ${e.city || '—'}\n` +
        `- **Provincia:** ${e.state || '—'}\n` +
        `- **Email:** ${e.email || '—'}\n` +
        `- **Teléfono:** ${e.phone || '—'}`,
    }],
  };
}

export async function handleListarSucursales(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string> = {};
  if (args.empresa_id) params.company_id = String(args.empresa_id);

  const result = await client.get<unknown>('/api/semilla/branches', params);
  const sucs = unwrapArray(result);

  if (!sucs.length) return { content: [{ type: 'text', text: 'No hay sucursales.' }] };

  const rows = sucs.map((s) =>
    `- **${s.name}** | ${s.address || '—'} | ${s.city || '—'} | \`${s.id}\``
  );

  return { content: [{ type: 'text', text: `## Sucursales (${sucs.length})\n\n${rows.join('\n')}` }] };
}
