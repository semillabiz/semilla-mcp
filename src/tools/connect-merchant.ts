/**
 * Tools de Semilla Connect — modo MERCHANT (comercio / POS).
 *
 * Operaciones del POS de Connect:
 *   - Sesión: abrir, cerrar, ver activa.
 *   - Órdenes: crear, listar, ver detalle, cancelar.
 *   - Productos: listar, crear, actualizar, eliminar, ver.
 *   - Categorías: listar, crear.
 *   - Métodos de pago: listar.
 *   - Perfil del comercio: actualizar.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectClient,
  unwrapConnect,
  unwrapConnectArray,
  extractAuthOverrides,
} from '../connect-client.js';

const userIdProp = {
  user_id: { type: 'string', description: 'UUID del usuario merchant. Opcional — se resuelve del JWT si se omite.' },
  business_id: { type: 'string', description: 'UUID del negocio activo (solo merchants multi-local). Opcional.' },
};

const merchantIdProp = {
  merchant_id: { type: 'string', description: 'UUID del merchant_profile (requerido por el backend POS).' },
};

export const connectMerchantTools: Tool[] = [
  // Sesiones POS
  {
    name: 'connect_merchant_pos_session_open',
    description: 'Abre una sesión de caja POS con monto inicial opcional.',
    annotations: { title: 'Abrir sesión POS', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        opening_balance: { type: 'number', description: 'Monto inicial de caja (cash_balance_start).' },
        notes: { type: 'string', description: 'Notas de apertura (opening_notes).' },
      },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_merchant_pos_session_close',
    description: 'Cierra una sesión de caja POS por id.',
    annotations: { title: 'Cerrar sesión POS', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID de la sesión.' },
        closing_balance: { type: 'number', description: 'Monto final contado.' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_merchant_pos_session_active',
    description: 'Devuelve la sesión POS activa del merchant, o null si no hay.',
    annotations: { title: 'Sesión POS activa', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, ...merchantIdProp },
      required: ['merchant_id'],
    },
  },

  // Órdenes
  {
    name: 'connect_merchant_pos_orders_create',
    description:
      'Crea una orden POS con líneas y pagos. Requiere sesión POS abierta. ' +
      'Los pagos son un array de {payment_method_id, amount}.',
    annotations: { title: 'Crear orden POS', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        session_id: { type: 'string', description: 'UUID de la sesión POS abierta.' },
        lines: {
          type: 'array',
          description: 'Líneas de la orden.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              product_name_snapshot: { type: 'string', description: 'Nombre snapshot del producto al momento de la venta.' },
              qty: { type: 'number' },
              price_unit: { type: 'number' },
              discount: { type: 'number', description: 'Porcentaje de descuento 0-100, opcional.' },
            },
            required: ['product_name_snapshot', 'qty', 'price_unit'],
          },
        },
        payments: {
          type: 'array',
          description: 'Pagos asociados a la orden. La suma debe ser >= total.',
          items: {
            type: 'object',
            properties: {
              payment_method_id: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['payment_method_id', 'amount'],
          },
        },
        customer_name: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['merchant_id', 'session_id', 'lines', 'payments'],
    },
  },
  {
    name: 'connect_merchant_pos_orders_list',
    description: 'Lista órdenes POS con filtros por rango de fechas, estado y sesión.',
    annotations: { title: 'Órdenes POS (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        from: { type: 'string' },
        to: { type: 'string' },
        state: { type: 'string', description: 'draft | paid | cancelled' },
        session_id: { type: 'string' },
      },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_merchant_pos_orders_get',
    description: 'Devuelve una orden POS completa con líneas y pagos.',
    annotations: { title: 'Detalle de orden POS', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID de la orden.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_merchant_pos_orders_cancel',
    description: 'Cancela una orden POS. Requiere merchant_id del negocio activo.',
    annotations: { title: 'Cancelar orden POS', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID de la orden.' },
        merchant_id: { type: 'string', description: 'UUID del merchant_profile.' },
      },
      required: ['id', 'merchant_id'],
    },
  },

  // Productos
  {
    name: 'connect_merchant_pos_products_list',
    description: 'Lista productos del catálogo POS.',
    annotations: { title: 'Productos POS (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        q: { type: 'string', description: 'Texto libre de búsqueda (se envía como `search` al backend).' },
        category_id: { type: 'string' },
      },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_merchant_pos_products_get',
    description: 'Devuelve el detalle de un producto del POS por id.',
    annotations: { title: 'Detalle de producto POS', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del producto.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_merchant_pos_products_create',
    description: 'Crea un producto en el catálogo POS.',
    annotations: { title: 'Crear producto POS', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        name: { type: 'string' },
        price: { type: 'number' },
        category_id: { type: 'string' },
        image_url: { type: 'string' },
        stock_quantity: { type: 'number' },
        barcode: { type: 'string' },
        cost_price: { type: 'number' },
        description: { type: 'string' },
        available_in_pos: { type: 'boolean', default: true },
      },
      required: ['merchant_id', 'name', 'price'],
    },
  },
  {
    name: 'connect_merchant_pos_products_update',
    description: 'Actualiza un producto del POS.',
    annotations: { title: 'Actualizar producto POS', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del producto.' },
        name: { type: 'string' },
        price: { type: 'number' },
        category_id: { type: 'string' },
        image_url: { type: 'string' },
        stock_quantity: { type: 'number' },
        barcode: { type: 'string' },
        cost_price: { type: 'number' },
        description: { type: 'string' },
        available_in_pos: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_merchant_pos_products_delete',
    description: 'Elimina un producto del POS.',
    annotations: { title: 'Eliminar producto POS', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string' } },
      required: ['id'],
    },
  },

  // Categorías
  {
    name: 'connect_merchant_pos_categories_list',
    description: 'Lista las categorías del POS.',
    annotations: { title: 'Categorías POS (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, ...merchantIdProp },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_merchant_pos_categories_create',
    description: 'Crea una categoría POS.',
    annotations: { title: 'Crear categoría POS', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        name: { type: 'string' },
        parent_id: { type: 'string', description: 'UUID de la categoría padre (opcional).' },
        sequence: { type: 'number', description: 'Orden de aparición (default 10).' },
      },
      required: ['merchant_id', 'name'],
    },
  },

  // Métodos de pago
  {
    name: 'connect_merchant_pos_payment_methods_list',
    description: 'Lista los métodos de pago configurados en el POS.',
    annotations: { title: 'Métodos de pago POS', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, ...merchantIdProp },
      required: ['merchant_id'],
    },
  },

  // Perfil
  {
    name: 'connect_merchant_profile_get_mine',
    description:
      'Devuelve el perfil de comercio (merchant_profile) del usuario logueado. Útil para que Copilot sepa qué negocio tiene el usuario antes de operar (su id, nombre, slug, si es gym, etc). Si el usuario no tiene comercio reclamado, responde "perfil no encontrado".',
    annotations: { title: 'Mi comercio', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
  {
    name: 'connect_merchant_profile_update',
    description: 'Actualiza el perfil público del comercio.',
    annotations: { title: 'Actualizar perfil del comercio', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del merchant_profile.' },
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        city: { type: 'string' },
        address: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        website: { type: 'string' },
        logo_url: { type: 'string' },
        cover_image_url: { type: 'string' },
      },
      required: ['id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Sesiones

export async function handleMerchantPosSessionOpen(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.post<any>('/api/shared/pos/sessions', {
    merchant_id: args.merchant_id,
    cash_balance_start: args.opening_balance,
    opening_notes: args.notes,
  }, { userId: auth.userId, businessId: auth.businessId });
  const data = result?.session ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Sesión POS abierta\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Saldo inicial:** $${args.opening_balance ?? 0}`,
    }],
  };
}

export async function handleMerchantPosSessionClose(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(
    `/api/shared/pos/sessions/${encodeURIComponent(id)}/close`,
    { closing_balance: args.closing_balance, notes: args.notes },
    { userId: auth.userId, businessId: auth.businessId },
  );
  return { content: [{ type: 'text', text: `## Sesión cerrada\n\n- **ID:** \`${id}\`` }] };
}

export async function handleMerchantPosSessionActive(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/pos/sessions/active', {
    params: { merchant_id: String(args.merchant_id) },
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const session = result?.session ?? result?.data ?? result;
  if (!session || !session.id) {
    return { content: [{ type: 'text', text: 'No hay sesión POS activa.' }] };
  }
  return {
    content: [{
      type: 'text',
      text:
        `## Sesión activa\n\n` +
        `- **ID:** \`${session.id}\`\n` +
        `- **Abierta:** ${session.opened_at}\n` +
        `- **Estado:** ${session.state}\n` +
        `- **Ventas:** $${session.total_sales ?? 0} (${session.total_orders ?? 0} órdenes)`,
    }],
  };
}

// Órdenes

export async function handleMerchantPosOrdersCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body = {
    merchant_id: args.merchant_id,
    session_id: args.session_id,
    lines: args.lines,
    payments: args.payments,
    customer_name: args.customer_name,
    notes: args.notes,
  };
  const result = await client.post<any>('/api/shared/pos/orders', body, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const data = result?.order ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Orden creada\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Total:** $${data?.amount_total ?? data?.total ?? '—'}`,
    }],
  };
}

export async function handleMerchantPosOrdersList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | undefined> = {
    merchant_id: String(args.merchant_id),
    from: args.from ? String(args.from) : undefined,
    to: args.to ? String(args.to) : undefined,
    state: args.state ? String(args.state) : undefined,
    session_id: args.session_id ? String(args.session_id) : undefined,
  };
  const result = await client.get<any>('/api/shared/pos/orders', {
    params,
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const items: Record<string, unknown>[] = Array.isArray(result?.orders)
    ? result.orders
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay órdenes.' }] };
  const rows = items.map((o: any) =>
    `- **${o.created_at || '—'}** | $${o.amount_total ?? o.total} | _${o.state}_ | ${o.customer_name || '—'} \`${o.id}\``,
  );
  return { content: [{ type: 'text', text: `## Órdenes (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleMerchantPosOrdersGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<any>(`/api/shared/pos/orders/${encodeURIComponent(id)}`, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const order = result?.order ?? result?.data ?? result;
  if (!order || !order.id) return { content: [{ type: 'text', text: 'Orden no encontrada.' }] };
  const lines = (order.lines || []).map((l: any) =>
    `  - ${l.qty} x ${l.product_name_snapshot || l.product_name || l.product_id} @ $${l.price_unit ?? l.unit_price} = $${l.price_subtotal ?? l.subtotal ?? '—'}`,
  ).join('\n');
  return {
    content: [{
      type: 'text',
      text:
        `## Orden\n\n` +
        `- **ID:** \`${order.id}\`\n` +
        `- **Estado:** ${order.state}\n` +
        `- **Total:** $${order.amount_total ?? order.total}\n\n` +
        `### Líneas\n${lines || '(vacío)'}`,
    }],
  };
}

export async function handleMerchantPosOrdersCancel(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(
    `/api/shared/pos/orders/${encodeURIComponent(id)}/cancel`,
    { merchant_id: args.merchant_id },
    { userId: auth.userId, businessId: auth.businessId },
  );
  return { content: [{ type: 'text', text: `## Orden cancelada\n\n- **ID:** \`${id}\`` }] };
}

// Productos

export async function handleMerchantPosProductsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | undefined> = {
    merchant_id: String(args.merchant_id),
    search: args.q ? String(args.q) : undefined,
    category_id: args.category_id ? String(args.category_id) : undefined,
  };
  const result = await client.get<any>('/api/shared/pos/products', {
    params,
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const items: Record<string, unknown>[] = Array.isArray(result?.products)
    ? result.products
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay productos.' }] };
  const rows = items.map((p) =>
    `- **${p.name}** | $${p.price} | ${p.category_name || '—'} | stock: ${p.stock_quantity ?? p.stock ?? '—'} \`${p.id}\``,
  );
  return { content: [{ type: 'text', text: `## Productos (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleMerchantPosProductsGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<any>(`/api/shared/pos/products/${encodeURIComponent(id)}`, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const p: any = result?.product ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Producto POS\n\n` +
        `- **ID:** \`${p?.id || id}\`\n` +
        `- **Nombre:** ${p?.name || '—'}\n` +
        `- **Precio:** $${p?.price ?? '—'}\n` +
        `- **Categoría:** ${p?.category_name || p?.category_id || '—'}\n` +
        `- **Stock:** ${p?.stock_quantity ?? p?.stock ?? '—'}\n` +
        `- **Barcode:** ${p?.barcode || '—'}\n` +
        `- **Activo:** ${p?.is_active === false ? 'no' : 'sí'}`,
    }],
  };
}

export async function handleMerchantPosProductsCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = { merchant_id: args.merchant_id };
  for (const k of [
    'name', 'price', 'category_id', 'image_url', 'stock_quantity', 'barcode',
    'cost_price', 'description', 'available_in_pos',
  ]) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  const result = await client.post<any>('/api/shared/pos/products', body, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const data = result?.product ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Producto creado\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Nombre:** ${args.name}`,
    }],
  };
}

export async function handleMerchantPosProductsUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of [
    'name', 'price', 'category_id', 'image_url', 'stock_quantity', 'barcode',
    'cost_price', 'description', 'available_in_pos',
  ]) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>(`/api/shared/pos/products/${encodeURIComponent(id)}`, body, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  return { content: [{ type: 'text', text: `## Producto actualizado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleMerchantPosProductsDelete(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.del<unknown>(`/api/shared/pos/products/${encodeURIComponent(id)}`, {
    userId: auth.userId,
    businessId: auth.businessId,
  });
  return { content: [{ type: 'text', text: `## Producto eliminado\n\n- **ID:** \`${id}\`` }] };
}

// Categorías

export async function handleMerchantPosCategoriesList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/pos/categories', {
    params: { merchant_id: String(args.merchant_id) },
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const items: Record<string, unknown>[] = Array.isArray(result?.categories)
    ? result.categories
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay categorías.' }] };
  const rows = items.map((c) => `- **${c.name}** \`${c.id}\``);
  return { content: [{ type: 'text', text: `## Categorías\n\n${rows.join('\n')}` }] };
}

export async function handleMerchantPosCategoriesCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.post<any>('/api/shared/pos/categories', {
    merchant_id: args.merchant_id,
    name: args.name,
    parent_id: args.parent_id,
    sequence: args.sequence,
  }, { userId: auth.userId, businessId: auth.businessId });
  const data = result?.category ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Categoría creada\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Nombre:** ${args.name}`,
    }],
  };
}

// Métodos de pago

export async function handleMerchantPosPaymentMethodsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/pos/payment-methods', {
    params: { merchant_id: String(args.merchant_id) },
    userId: auth.userId,
    businessId: auth.businessId,
  });
  const items: Record<string, unknown>[] = Array.isArray(result?.payment_methods)
    ? result.payment_methods
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay métodos de pago.' }] };
  const rows = items.map((m) => `- **${m.name}** (${m.type || '—'}) \`${m.id}\``);
  return { content: [{ type: 'text', text: `## Métodos de pago\n\n${rows.join('\n')}` }] };
}

// Perfil

export async function handleMerchantProfileGetMine(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const userId = client.resolveUserId(auth.userId);
  const result = await client.get<any>('/api/shared/merchants/me', {
    params: { user_id: userId },
    userId: auth.userId,
  });
  const payload = result?.merchant || unwrapConnect<Record<string, unknown>>(result);
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    return { content: [{ type: 'text', text: 'El usuario no tiene un perfil de comercio asociado.' }] };
  }
  const m = payload as Record<string, unknown>;
  const lines: string[] = [
    '## Mi comercio',
    '',
    `- **ID:** \`${m.id}\``,
    `- **Nombre:** ${m.name || '—'}`,
    `- **Slug:** ${m.slug || '—'}`,
    `- **Categoría:** ${m.category || '—'}`,
    `- **Ciudad:** ${m.city || '—'}`,
    `- **Es gimnasio:** ${m.is_gym ? 'sí' : 'no'}`,
    `- **Estado:** ${m.status || '—'}`,
    `- **Reclamado:** ${m.is_claimed ? 'sí' : 'no'}`,
  ];
  if (m.phone) lines.push(`- **Teléfono:** ${m.phone}`);
  if (m.email) lines.push(`- **Email:** ${m.email}`);
  if (m.website) lines.push(`- **Website:** ${m.website}`);
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

export async function handleMerchantProfileUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of [
    'name', 'description', 'category', 'city', 'address', 'phone', 'email',
    'website', 'logo_url', 'cover_image_url',
  ]) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>(`/api/shared/merchants/${encodeURIComponent(id)}`, body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Perfil actualizado\n\n- **ID:** \`${id}\`` }] };
}
