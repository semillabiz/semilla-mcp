/**
 * Tools de listas de precios para Semilla MCP.
 * Endpoints: /api/semilla/price-lists
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency } from '../client.js';

export const priceListTools: Tool[] = [
  {
    name: 'get_listas_precios',
    description:
      'Lista todas las listas de precios activas del tenant. ' +
      'Muestra nombre, moneda, tipo de precio base, si es predeterminada y cuántas reglas tiene.',
    annotations: { title: 'Consultar listas de precios', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_lista_precios',
    description:
      'Obtiene el detalle completo de una lista de precios: encabezado + todas sus reglas. ' +
      'Cada regla muestra el alcance (producto/categoría/global), método de cálculo y valor.',
    annotations: { title: 'Consultar lista de precios', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        lista_id: {
          type: 'string',
          description: 'UUID de la lista de precios',
        },
      },
      required: ['lista_id'],
    },
  },
  {
    name: 'resolver_precio',
    description:
      'Calcula el precio final de un producto aplicando las reglas de la lista correspondiente. ' +
      'Útil para responder "¿a cuánto le sale este producto al cliente X si compra Y unidades?"',
    annotations: { title: 'Resolver precio', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID de la variante de producto',
        },
        cantidad: {
          type: 'number',
          description: 'Cantidad a comprar (afecta escalas por volumen)',
          default: 1,
        },
        cliente_id: {
          type: 'string',
          description: 'UUID del cliente (para usar su lista asignada)',
        },
        lista_id: {
          type: 'string',
          description: 'UUID de lista específica (override manual)',
        },
      },
      required: ['producto_id'],
    },
  },
  {
    name: 'crear_lista_precios',
    description:
      'Crea una nueva lista de precios. ' +
      'Para listas basadas en otra lista, usar base_price_type="other_list" e indicar base_lista_id.',
    annotations: { title: 'Crear lista de precios', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          description: 'Nombre de la lista (ej: "Mayorista", "VIP", "Distribuidores")',
        },
        base_price_type: {
          type: 'string',
          enum: ['sale_price', 'cost_price', 'other_list'],
          description: 'Precio base para las fórmulas: precio de venta, costo, u otra lista',
          default: 'sale_price',
        },
        base_lista_id: {
          type: 'string',
          description: 'UUID de la lista base (solo si base_price_type="other_list")',
        },
        es_predeterminada: {
          type: 'boolean',
          description: 'Si es la lista predeterminada del tenant',
          default: false,
        },
        notas: {
          type: 'string',
          description: 'Notas internas sobre la lista',
        },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'agregar_regla_precio',
    description:
      'Agrega una regla de precio a una lista existente. ' +
      'Tipos: fixed (precio fijo), discount (% descuento sobre base), markup (% recargo), formula (factor × base + fijo). ' +
      'Se puede aplicar a un producto, template, categoría, o a todos los productos (regla global).',
    annotations: { title: 'Agregar regla de precio', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        lista_id: {
          type: 'string',
          description: 'UUID de la lista donde agregar la regla',
        },
        compute_price: {
          type: 'string',
          enum: ['fixed', 'discount', 'markup', 'formula'],
          description: 'Método de cálculo del precio',
        },
        fixed_price: {
          type: 'number',
          description: 'Precio fijo (solo para compute_price="fixed")',
        },
        discount_pct: {
          type: 'number',
          description: 'Porcentaje de descuento 0-100 (solo para compute_price="discount")',
        },
        markup_pct: {
          type: 'number',
          description: 'Porcentaje de recargo (solo para compute_price="markup")',
        },
        price_factor: {
          type: 'number',
          description: 'Factor multiplicador (solo para compute_price="formula")',
        },
        price_surcharge: {
          type: 'number',
          description: 'Suma fija al resultado de la fórmula',
        },
        producto_id: {
          type: 'string',
          description: 'UUID de variante de producto (aplica solo a ese producto)',
        },
        categoria_id: {
          type: 'string',
          description: 'UUID de categoría (aplica a todos los productos de la categoría)',
        },
        cantidad_minima: {
          type: 'number',
          description: 'Cantidad mínima para activar esta regla (escalas por volumen)',
          default: 0,
        },
        prioridad: {
          type: 'number',
          description: 'Prioridad (menor número = mayor prioridad)',
          default: 10,
        },
      },
      required: ['lista_id', 'compute_price'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGetListasPrecios(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/price-lists');
  const lists: Record<string, unknown>[] =
    Array.isArray(result) ? result : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (!lists.length) {
    return { content: [{ type: 'text', text: 'No hay listas de precios configuradas.' }] };
  }

  const rows = lists.map((l) => {
    const def = l.is_default ? ' ⭐ predeterminada' : '';
    const base =
      l.base_price_type === 'sale_price' ? 'precio de venta' :
      l.base_price_type === 'cost_price' ? 'costo' : 'otra lista';
    return `- **${l.name}**${def} — base: ${base}, ${l.item_count ?? '?'} reglas`;
  });

  return {
    content: [{
      type: 'text',
      text: `## Listas de precios (${lists.length})\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleGetListaPrecios(args: Record<string, unknown>) {
  const client = getClient();
  const listaId = String(args.lista_id);

  const [listResult, itemsResult] = await Promise.all([
    client.get<unknown>(`/api/semilla/price-lists/${listaId}`),
    client.get<unknown>(`/api/semilla/price-lists/${listaId}/items`),
  ]);

  const list =
    ((listResult as Record<string, unknown>)?.data ?? listResult) as Record<string, unknown>;
  const items: Record<string, unknown>[] =
    Array.isArray(itemsResult) ? itemsResult :
    ((itemsResult as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (!list?.id) {
    return { content: [{ type: 'text', text: `Lista "${listaId}" no encontrada.` }] };
  }

  const baseLabel =
    list.base_price_type === 'sale_price' ? 'precio de venta' :
    list.base_price_type === 'cost_price' ? 'costo' : 'otra lista';

  const itemsText = items.length
    ? items.map((item) => {
        const scope =
          item.product_name ? `Producto: ${item.product_name}` :
          item.category_name ? `Categoría: ${item.category_name}` : 'Global (todos los productos)';
        const method =
          item.compute_price === 'fixed' ? `precio fijo ${formatCurrency(Number(item.fixed_price))}` :
          item.compute_price === 'discount' ? `${item.discount_pct}% descuento` :
          item.compute_price === 'markup' ? `${item.markup_pct}% recargo` :
          `fórmula ×${item.price_factor} +${item.price_surcharge}`;
        const minQty = Number(item.min_quantity) > 0 ? ` (min. ${item.min_quantity} u.)` : '';
        return `  ${item.priority}. ${scope} — ${method}${minQty}`;
      }).join('\n')
    : '  (sin reglas)';

  return {
    content: [{
      type: 'text',
      text:
        `## Lista: ${list.name}\n\n` +
        `- **Precio base:** ${baseLabel}\n` +
        `- **Moneda:** ${list.currency_code}\n` +
        `- **Predeterminada:** ${list.is_default ? 'Sí' : 'No'}\n\n` +
        `**Reglas (${items.length}):**\n${itemsText}`,
    }],
  };
}

export async function handleResolverPrecio(args: Record<string, unknown>) {
  const client = getClient();

  const body: Record<string, unknown> = {
    productVariantId: String(args.producto_id),
    quantity: Number(args.cantidad ?? 1),
  };
  if (args.cliente_id) body.partnerId = String(args.cliente_id);
  if (args.lista_id) body.pricelistId = String(args.lista_id);

  const result = await client.post<unknown>('/api/semilla/price-lists/resolve-price', body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  if (!data) {
    return { content: [{ type: 'text', text: 'No se pudo calcular el precio.' }] };
  }

  const basePrice = formatCurrency(Number(data.basePrice));
  const finalPrice = formatCurrency(Number(data.finalPrice));
  const discount = data.discountPct ? ` (${data.discountPct}% desc.)` : '';
  const listLine = data.pricelistName
    ? `\n- **Lista aplicada:** ${data.pricelistName}`
    : '\n- **Lista aplicada:** ninguna (precio normal)';
  const methodLine = data.computeMethod
    ? `\n- **Método:** ${data.computeMethod}` : '';

  return {
    content: [{
      type: 'text',
      text:
        `## Precio resuelto\n\n` +
        `- **Precio base:** ${basePrice}\n` +
        `- **Precio final:** **${finalPrice}**${discount}` +
        listLine + methodLine,
    }],
  };
}

export async function handleCrearListaPrecios(args: Record<string, unknown>) {
  const client = getClient();

  const body: Record<string, unknown> = {
    name: String(args.nombre),
    base_price_type: String(args.base_price_type ?? 'sale_price'),
    is_default: Boolean(args.es_predeterminada ?? false),
  };
  if (args.base_lista_id) body.base_pricelist_id = String(args.base_lista_id);
  if (args.notas) body.notes = String(args.notas);

  const result = await client.post<unknown>('/api/semilla/price-lists', body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text: `✅ Lista de precios **${data.name ?? args.nombre}** creada con ID \`${data.id}\`.`,
    }],
  };
}

export async function handleAgregarReglaPrecio(args: Record<string, unknown>) {
  const client = getClient();
  const listaId = String(args.lista_id);

  const body: Record<string, unknown> = {
    compute_price: String(args.compute_price),
    min_quantity: Number(args.cantidad_minima ?? 0),
    priority: Number(args.prioridad ?? 10),
  };

  if (args.fixed_price !== undefined) body.fixed_price = Number(args.fixed_price);
  if (args.discount_pct !== undefined) body.discount_pct = Number(args.discount_pct);
  if (args.markup_pct !== undefined) body.markup_pct = Number(args.markup_pct);
  if (args.price_factor !== undefined) body.price_factor = Number(args.price_factor);
  if (args.price_surcharge !== undefined) body.price_surcharge = Number(args.price_surcharge);
  if (args.producto_id) body.product_variant_id = String(args.producto_id);
  if (args.categoria_id) body.category_id = String(args.categoria_id);

  await client.post<unknown>(`/api/semilla/price-lists/${listaId}/items`, body);

  const methodDesc =
    args.compute_price === 'fixed' ? `precio fijo ${formatCurrency(Number(args.fixed_price))}` :
    args.compute_price === 'discount' ? `${args.discount_pct}% de descuento` :
    args.compute_price === 'markup' ? `${args.markup_pct}% de recargo` :
    `fórmula ×${args.price_factor}`;

  return {
    content: [{ type: 'text', text: `✅ Regla agregada: ${methodDesc}.` }],
  };
}
