/**
 * Tools de Logística para Semilla MCP.
 * Endpoints: /api/semilla/verticals/logistics
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap, unwrapArray } from '../client.js';

export const logisticsTools: Tool[] = [
  {
    name: 'logis_get_dashboard',
    description: 'Métricas de Logística: total productos, stock total, productos bajo mínimo, empleados, asignaciones.',
    annotations: { title: 'Dashboard de logística', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'logis_listar_categorias',
    description: 'Lista categorías de productos logísticos.',
    annotations: { title: 'Listar categorías (logística)', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'logis_listar_productos',
    description: 'Lista productos logísticos con stock actual y mínimo.',
    annotations: { title: 'Listar productos (logística)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        categoria_id: { type: 'string', description: 'Filtrar por categoría' },
        bajo_minimo: { type: 'boolean', description: 'Solo productos con stock bajo el mínimo', default: false },
        limit: { type: 'number', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'logis_listar_empleados',
    description: 'Lista empleados de logística (para asignar entregas).',
    annotations: { title: 'Listar empleados (logística)', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'logis_listar_asignaciones',
    description: 'Lista asignaciones de entrega (a quién se le asignó qué y cuándo).',
    annotations: { title: 'Listar asignaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'Filtrar por empleado' },
        producto_id: { type: 'string', description: 'Filtrar por producto' },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
        limit: { type: 'number', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'logis_preview_crear_asignacion',
    description: 'PASO 1: Previsualiza una nueva asignación. Después usar `logis_confirmar_crear_asignacion`.',
    annotations: { title: 'Previsualizar asignación (paso 1)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string' },
        producto_id: { type: 'string' },
        cantidad: { type: 'number' },
        notas: { type: 'string' },
      },
      required: ['empleado_id', 'producto_id', 'cantidad'],
    },
  },
  {
    name: 'logis_confirmar_crear_asignacion',
    description: 'PASO 2: Crea la asignación (decrementa stock).',
    annotations: { title: 'Confirmar asignación (paso 2)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string' },
        producto_id: { type: 'string' },
        cantidad: { type: 'number' },
        notas: { type: 'string' },
      },
      required: ['empleado_id', 'producto_id', 'cantidad'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleLogisGetDashboard(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/verticals/logistics/dashboard/metrics');
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Dashboard Logística\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleLogisListarCategorias(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/verticals/logistics/categories');
  const cats = unwrapArray(result);
  if (!cats.length) return { content: [{ type: 'text', text: 'No hay categorías cargadas.' }] };
  const rows = cats.map((c) => `- **${c.name}** | \`${c.id}\``);
  return { content: [{ type: 'text', text: `## Categorías (${cats.length})\n\n${rows.join('\n')}` }] };
}

export async function handleLogisListarProductos(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number | boolean> = { limit: Number(args.limit || 50) };
  if (args.categoria_id) params.category_id = String(args.categoria_id);
  if (args.bajo_minimo) params.below_min = true;

  const result = await client.get<unknown>('/api/semilla/verticals/logistics/products', params);
  const prods = unwrapArray(result);

  if (!prods.length) return { content: [{ type: 'text', text: 'No hay productos que coincidan.' }] };

  const rows = prods.map((p) => {
    const stock = Number(p.stock || 0);
    const min = Number(p.min_stock || 0);
    const alerta = stock < min ? ' ⚠️ BAJO MÍNIMO' : '';
    return `- **${p.name}** | SKU: ${p.sku || '—'} | Stock: ${stock}${min ? ` (min: ${min})` : ''}${alerta}`;
  });

  return { content: [{ type: 'text', text: `## Productos logísticos (${prods.length})\n\n${rows.join('\n')}` }] };
}

export async function handleLogisListarEmpleados(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/verticals/logistics/employees');
  const emps = unwrapArray(result);
  if (!emps.length) return { content: [{ type: 'text', text: 'No hay empleados.' }] };
  const rows = emps.map((e) => `- **${e.name || e.full_name}** | ${e.role || '—'} | \`${e.id}\``);
  return { content: [{ type: 'text', text: `## Empleados (${emps.length})\n\n${rows.join('\n')}` }] };
}

export async function handleLogisListarAsignaciones(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { limit: Number(args.limit || 30) };
  if (args.empleado_id) params.employee_id = String(args.empleado_id);
  if (args.producto_id) params.product_id = String(args.producto_id);
  if (args.desde) params.from = String(args.desde);
  if (args.hasta) params.to = String(args.hasta);

  const result = await client.get<unknown>('/api/semilla/verticals/logistics/assignments', params);
  const asigs = unwrapArray(result);

  if (!asigs.length) return { content: [{ type: 'text', text: 'No hay asignaciones que coincidan.' }] };

  const rows = asigs.map((a) =>
    `- ${formatDate(String(a.date || a.created_at || ''))} | ` +
    `${a.employee_name || a.employee_id || '—'} | ` +
    `${a.product_name || a.product_id || '—'} × ${a.quantity || 1}`
  );

  return { content: [{ type: 'text', text: `## Asignaciones (${asigs.length})\n\n${rows.join('\n')}` }] };
}

export async function handleLogisPreviewCrearAsignacion(args: Record<string, unknown>) {
  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nueva asignación\n\n` +
        `- **Empleado ID:** ${args.empleado_id}\n` +
        `- **Producto ID:** ${args.producto_id}\n` +
        `- **Cantidad:** ${args.cantidad}\n` +
        (args.notas ? `- **Notas:** ${args.notas}\n` : '') +
        `\nAl confirmar:\n- Se decrementa el stock del producto\n- Queda la asignación registrada al empleado\n\n` +
        `---\n⚠️ Para confirmar, usar \`logis_confirmar_crear_asignacion\`.`,
    }],
  };
}

export async function handleLogisConfirmarCrearAsignacion(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    employee_id: args.empleado_id,
    product_id: args.producto_id,
    quantity: args.cantidad,
  };
  if (args.notas) body.notes = args.notas;

  const result = await client.post<unknown>('/api/semilla/verticals/logistics/assignments', body);
  const a = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Asignación creada\n\n` +
        `- **ID:** \`${a?.id || '—'}\`\n` +
        `- **Empleado:** ${args.empleado_id}\n` +
        `- **Producto:** ${args.producto_id} × ${args.cantidad}`,
    }],
  };
}
