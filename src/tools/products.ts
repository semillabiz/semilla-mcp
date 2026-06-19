/**
 * Tools de productos e inventario para Semilla MCP.
 * Endpoints: /api/semilla/products, /api/semilla/inventory/stock
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency } from '../client.js';

// ─── Definiciones de tools ────────────────────────────────────────────────────

export const productTools: Tool[] = [
  {
    name: 'buscar_productos',
    description:
      'Busca productos en el catálogo de Semilla por nombre, SKU o código de barras. ' +
      'Devuelve nombre, precio, stock actual, categoría y código.',
    annotations: { title: 'Buscar productos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto de búsqueda: nombre, SKU o código de barras',
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
        categoria: {
          type: 'string',
          description: 'Filtrar por categoría (opcional)',
        },
        solo_con_stock: {
          type: 'boolean',
          description: 'Si true, devuelve solo productos con stock > 0',
          default: false,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_stock',
    description:
      'Consulta el stock actual de productos. Puede filtrar por producto específico, ' +
      'categoría o mostrar los productos con stock bajo (por debajo del mínimo).',
    annotations: { title: 'Consultar stock', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto para consultar su stock específico',
        },
        query: {
          type: 'string',
          description: 'Nombre o SKU para buscar el stock de un producto',
        },
        solo_bajo_minimo: {
          type: 'boolean',
          description: 'Si true, muestra solo productos con stock bajo el mínimo',
          default: false,
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 20)',
          default: 20,
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
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleBuscarProductos(args: Record<string, unknown>) {
  const client = getClient();
  const query = String(args.query || '');
  const limit = Number(args.limit || 10);
  const offset = Number(args.offset || 0);
  const categoria = args.categoria ? String(args.categoria) : undefined;
  const soloConStock = Boolean(args.solo_con_stock);

  const params: Record<string, string | number | boolean> = { search: query, limit, offset };
  if (categoria) params.category = categoria;

  try {
    const result = await client.get<unknown>('/api/semilla/products', params);
    let products: Record<string, unknown>[] = [];

    if (Array.isArray(result)) {
      products = result as Record<string, unknown>[];
    } else if (result && typeof result === 'object' && 'data' in result) {
      products = ((result as Record<string, unknown>).data as Record<string, unknown>[]) || [];
    }

    if (soloConStock) {
      products = products.filter((p) => (p.qty_available as number || 0) > 0);
    }

    if (!products.length) {
      return { content: [{ type: 'text', text: `No se encontraron productos para "${query}".` }] };
    }

    const rows = products.map((p) => {
      const price = p.unit_price || p.list_price || p.sale_price || 0;
      const stock = p.qty_available ?? p.stock ?? '—';
      const sku = p.code || p.default_code || p.sku || '—';
      return (
        `**${p.name}**\n` +
        `  ID: \`${p.id}\`\n` +
        `  SKU: ${sku} | Precio: ${formatCurrency(Number(price))} | Stock: ${stock}\n` +
        `  Categoría: ${p.category_name || p.categ_id || '—'}`
      );
    });

    let text = `## Productos encontrados (${products.length})\n\n${rows.join('\n\n')}`;
    if (products.length >= limit) {
      text += `\n\n---\n_Mostrando ${products.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }
    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo buscar productos: ${msg}.\nIntentá con una búsqueda más corta o verificá la sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}

export async function handleGetStock(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = args.producto_id ? String(args.producto_id) : undefined;
  const query = args.query ? String(args.query) : undefined;
  const soloBajoMinimo = Boolean(args.solo_bajo_minimo);
  const limit = Number(args.limit || 20);
  const offset = Number(args.offset || 0);

  try {
    let resolvedProductId = productoId;
    if (!resolvedProductId && query) {
      const searchResult = await client.get<unknown>('/api/semilla/products', { search: query, limit: 1 });
      const found: Record<string, unknown>[] = Array.isArray(searchResult)
        ? searchResult as Record<string, unknown>[]
        : ((searchResult as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];
      if (!found.length) {
        return { content: [{ type: 'text', text: `No se encontró ningún producto con "${query}".` }] };
      }
      resolvedProductId = String(found[0].id);
    }

    const params: Record<string, string | number | boolean> = { offset };
    if (resolvedProductId) params.product_id = resolvedProductId;

    const result = await client.get<unknown>('/api/semilla/stock/quants', params);
    let items: Record<string, unknown>[] = Array.isArray(result)
      ? result as Record<string, unknown>[]
      : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

    if (soloBajoMinimo) {
      items = items.filter((item) => {
        const qty = Number(item.quantity ?? 0);
        const min = Number(item.reorder_point ?? item.min_qty ?? 0);
        return min > 0 && qty <= min;
      });
    }

    items = items.slice(0, limit);

    if (!items.length) {
      return { content: [{ type: 'text', text: `No se encontraron registros de stock${soloBajoMinimo ? ' bajo mínimo' : ''}.` }] };
    }

    const rows = items.map((item) => {
      const qty = Number(item.quantity ?? 0);
      const min = item.reorder_point || item.min_qty;
      const alert = min && qty <= Number(min) ? ' ⚠️' : '';
      const productName = (item.product as Record<string, unknown>)?.name || item.product_name || item.product_id;
      const locationName = (item.location as Record<string, unknown>)?.name || item.location_id || '—';
      return (
        `- **${productName}**${alert}: ${qty} uds — Ubicación: ${locationName}` +
        (min ? ` (mín: ${min})` : '')
      );
    });

    let text =
      `## Stock actual${soloBajoMinimo ? ' — bajo mínimo' : ''}\n\n` +
      rows.join('\n');

    if (items.length >= limit) {
      text += `\n\n---\n_Mostrando ${items.length} resultado(s). Usá \`offset: ${offset + limit}\` para ver más._`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `No se pudo consultar el stock: ${msg}.\nSi persiste, verificá tu sesión con \`estado_sesion\`.` }],
      isError: true,
    };
  }
}
