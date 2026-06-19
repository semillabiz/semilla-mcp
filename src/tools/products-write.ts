/**
 * Tools de escritura para productos en Semilla MCP.
 * Endpoint: PUT /api/semilla/products/:id
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency } from '../client.js';

export const productWriteTools: Tool[] = [
  {
    name: 'get_categorias',
    description:
      'Lista todas las categorías de productos disponibles en el sistema. ' +
      'Devuelve nombre e ID de cada categoría. Usá este tool para obtener el ' +
      'categoria_id antes de asignarlo a un producto con actualizar_producto.',
    annotations: { title: 'Consultar categorías', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Filtrar por nombre de categoría (opcional)',
        },
      },
      required: [],
    },
  },
  {
    name: 'actualizar_producto',
    description:
      'Actualiza los datos de un producto existente: nombre, SKU/código, precio, ' +
      'categoría, código de barras, estado activo, disponibilidad en POS. ' +
      'Podés actualizar uno o varios campos a la vez. ' +
      'Si no sabés el ID del producto, primero usá buscar_productos.',
    annotations: { title: 'Actualizar producto', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto a actualizar',
        },
        nombre: {
          type: 'string',
          description: 'Nuevo nombre del producto',
        },
        sku: {
          type: 'string',
          description: 'Nuevo código SKU / referencia interna (campo "code")',
        },
        codigo_barras: {
          type: 'string',
          description: 'Nuevo código de barras (EAN, UPC, etc.)',
        },
        precio_venta: {
          type: 'number',
          description: 'Nuevo precio de venta (unit_price)',
        },
        precio_costo: {
          type: 'number',
          description: 'Nuevo precio de costo (cost_price)',
        },
        categoria_id: {
          type: 'string',
          description: 'UUID de la nueva categoría del producto',
        },
        activo: {
          type: 'boolean',
          description: 'true = activo, false = inactivo/archivado',
        },
        disponible_en_pos: {
          type: 'boolean',
          description: 'Disponibilidad en el Punto de Venta',
        },
      },
      required: ['producto_id'],
    },
  },
  {
    name: 'asignar_sku_lote',
    description:
      'Asigna SKUs a múltiples productos de una vez. Útil para limpiar productos ' +
      'que no tienen código asignado. Recibe una lista de pares {producto_id, sku}.',
    annotations: { title: 'Asignar SKU (lote)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        asignaciones: {
          type: 'array',
          description: 'Lista de productos a actualizar',
          items: {
            type: 'object',
            properties: {
              producto_id: { type: 'string', description: 'UUID del producto' },
              sku: { type: 'string', description: 'SKU a asignar' },
            },
            required: ['producto_id', 'sku'],
          },
        },
      },
      required: ['asignaciones'],
    },
  },
  {
    name: 'buscar_productos_sin_sku',
    description:
      'Devuelve productos que no tienen SKU/código interno asignado. ' +
      'Útil para identificar qué productos necesitan ser completados.',
    annotations: { title: 'Buscar productos sin SKU', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleActualizarProducto(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);

  // Mapear campos del MCP a campos del ERP
  const body: Record<string, unknown> = {};
  if (args.nombre !== undefined)           body.name               = args.nombre;
  if (args.sku !== undefined)              body.code               = args.sku;
  if (args.codigo_barras !== undefined)    body.barcode            = args.codigo_barras;
  if (args.precio_venta !== undefined)     body.unit_price         = args.precio_venta;
  if (args.precio_costo !== undefined)     body.cost_price         = args.precio_costo;
  if (args.categoria_id !== undefined)     body.category_id        = args.categoria_id;
  if (args.activo !== undefined)           body.is_active          = args.activo;
  if (args.disponible_en_pos !== undefined) body.available_in_pos  = args.disponible_en_pos;

  if (Object.keys(body).length === 0) {
    return { content: [{ type: 'text', text: '⚠️ No se especificó ningún campo para actualizar.' }] };
  }

  // Leer datos actuales del producto para completar el PUT (evita borrar campos no enviados)
  try {
    const existing = await client.get<unknown>(`/api/semilla/products/${encodeURIComponent(productoId)}`);
    const data = ((existing as Record<string, unknown>)?.data ?? existing) as Record<string, unknown>;
    // Rellenar campos base solo si no vienen en el body del MCP
    if (body.name === undefined && data.name)           body.name       = data.name;
    if (body.unit_price === undefined)                  body.unit_price = data.unit_price || data.list_price || 0;
    if (body.cost_price === undefined)                  body.cost_price = data.cost_price || data.standard_price || 0;
    if (body.is_active === undefined && data.is_active !== undefined) body.is_active = data.is_active;
  } catch { /* si falla la lectura previa, continuar con el body parcial */ }

  const result = await client.request<unknown>(
    `/api/semilla/products/${encodeURIComponent(productoId)}`,
    { method: 'PUT', body }
  );
  const updated = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  const cambios = Object.entries(body)
    .map(([k, v]) => `- **${k}**: ${typeof v === 'number' ? formatCurrency(v) : String(v)}`)
    .join('\n');

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Producto actualizado\n\n` +
        `ID: \`${productoId}\`\n` +
        `Nombre actual: ${(updated as Record<string, unknown>)?.name || '—'}\n\n` +
        `**Cambios aplicados:**\n${cambios}`,
    }],
  };
}

export async function handleAsignarSkuLote(args: Record<string, unknown>) {
  const client = getClient();
  const asignaciones = args.asignaciones as { producto_id: string; sku: string }[];

  if (!asignaciones?.length) {
    return { content: [{ type: 'text', text: '⚠️ La lista de asignaciones está vacía.' }] };
  }

  const resultados: string[] = [];
  let exitosos = 0;
  let fallidos = 0;

  for (const { producto_id, sku } of asignaciones) {
    try {
      // El PUT del ERP puede requerir campos existentes — los leemos primero
      let existingBody: Record<string, unknown> = {};
      try {
        const existing = await client.get<unknown>(`/api/semilla/products/${encodeURIComponent(producto_id)}`);
        const data = ((existing as Record<string, unknown>)?.data ?? existing) as Record<string, unknown>;
        existingBody = {
          name: data.name,
          unit_price: data.unit_price || data.list_price || 0,
          cost_price: data.cost_price || data.standard_price || 0,
          is_active: data.is_active ?? true,
        };
      } catch { /* si falla la lectura, intentar sin datos existentes */ }

      await client.request<unknown>(
        `/api/semilla/products/${encodeURIComponent(producto_id)}`,
        { method: 'PUT', body: { ...existingBody, code: sku } }
      );
      resultados.push(`✅ ${String(existingBody.name || producto_id)} → SKU: **${sku}**`);
      exitosos++;
    } catch (err) {
      resultados.push(`❌ \`${producto_id}\` → Error: ${(err as Error).message}`);
      fallidos++;
    }
  }

  return {
    content: [{
      type: 'text',
      text:
        `## Asignación de SKUs en lote\n\n` +
        `✅ Exitosos: ${exitosos} | ❌ Fallidos: ${fallidos}\n\n` +
        resultados.join('\n'),
    }],
  };
}

export async function handleBuscarProductosSinSku(args: Record<string, unknown>) {
  const client = getClient();
  const limit = Number(args.limit || 30);

  // Buscar todos los productos y filtrar los que no tienen code/SKU
  const result = await client.get<unknown>('/api/semilla/products', { limit: 200 });
  let products: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  // Filtrar los sin SKU
  products = products
    .filter((p) => !p.code && !p.sku && !p.default_code)
    .slice(0, limit);

  if (!products.length) {
    return { content: [{ type: 'text', text: '✅ Todos los productos tienen SKU asignado.' }] };
  }

  const rows = products.map((p) =>
    `- **${p.name || '(sin nombre)'}** | ID: \`${p.id}\` | Precio: ${formatCurrency(Number(p.unit_price || p.list_price || 0))}`
  );

  return {
    content: [{
      type: 'text',
      text:
        `## Productos sin SKU (${products.length})\n\n` +
        rows.join('\n') +
        `\n\n---\n` +
        `Usá \`asignar_sku_lote\` para asignar SKUs en bloque, o ` +
        `\`actualizar_producto\` para editar uno por uno.`,
    }],
  };
}

export async function handleGetCategorias(args: Record<string, unknown>) {
  const client = getClient();
  const query = args.query ? String(args.query) : undefined;

  const params: Record<string, string | number> = { limit: 200 };
  if (query) params.search = query;

  const result = await client.get<unknown>('/api/semilla/product-categories', params);
  let cats: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (query) {
    const q = query.toLowerCase();
    cats = cats.filter((c) => String(c.name || '').toLowerCase().includes(q));
  }

  if (!cats.length) {
    return { content: [{ type: 'text', text: 'No se encontraron categorías.' }] };
  }

  const rows = cats.map((c) => {
    const parent = c.parent_name || c.parent_id ? ` (padre: ${c.parent_name || c.parent_id})` : '';
    return `- **${c.name}**${parent} | ID: \`${c.id}\``;
  });

  return {
    content: [{
      type: 'text',
      text: `## Categorías de productos (${cats.length})\n\n${rows.join('\n')}\n\n---\nUsá el ID con \`actualizar_producto\` para asignar una categoría.`,
    }],
  };
}
