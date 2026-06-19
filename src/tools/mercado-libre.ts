/**
 * Tools de MercadoLibre para Semilla MCP.
 * Endpoints: /api/semilla/mercado-libre/*
 * Cubre: estado de conexión, publicaciones, órdenes, preguntas y categorías.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency } from '../client.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractData<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'data' in result) {
    return ((result as Record<string, unknown>).data as T[]) || [];
  }
  return [];
}

function errText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
}

// ─── Definiciones de tools ────────────────────────────────────────────────────

export const mercadoLibreTools: Tool[] = [
  {
    name: 'ml_get_estado',
    description:
      'Estado de la integración con MercadoLibre: si la cuenta está conectada, si las ' +
      'credenciales de la app están cargadas, el vendedor (nickname/email), el país (site_id) ' +
      'y si el token de acceso está vencido.',
    annotations: { title: 'Estado de conexión (ML)', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ml_listar_publicaciones',
    description:
      'Lista las publicaciones de MercadoLibre vinculadas en el ERP (título, precio, stock, ' +
      'estado en ML, SKU y código de ítem MLA).',
    annotations: { title: 'Listar publicaciones (ML)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Máximo de resultados (default: 50)', default: 50 },
        offset: { type: 'number', description: 'Desplazamiento para paginación (default: 0)', default: 0 },
      },
    },
  },
  {
    name: 'ml_listar_ordenes',
    description: 'Lista las órdenes/ventas importadas de MercadoLibre. Puede filtrar por estado (ej: paid).',
    annotations: { title: 'Listar órdenes (ML)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filtrar por estado ML (paid, pending, cancelled, etc.)' },
        limit: { type: 'number', description: 'Máximo de resultados (default: 20)', default: 20 },
        offset: { type: 'number', description: 'Desplazamiento (default: 0)', default: 0 },
      },
    },
  },
  {
    name: 'ml_listar_preguntas',
    description: 'Lista las preguntas de compradores en MercadoLibre. Por defecto las sin responder.',
    annotations: { title: 'Listar preguntas (ML)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Estado: unanswered (default) o answered' },
        ml_item_code: { type: 'string', description: 'Filtrar por código de ítem ML (ej: MLA123...)' },
      },
    },
  },
  {
    name: 'ml_buscar_categorias',
    description:
      'Busca categorías de MercadoLibre en la caché local del ERP (requiere haber importado las ' +
      'categorías antes). Devuelve id, nombre y ruta completa.',
    annotations: { title: 'Buscar categorías (ML)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Texto a buscar (mínimo 2 caracteres)' },
        site_id: { type: 'string', description: 'País ML (MLA, MLB, MLM, MLC, MCO). Default: el de la conexión.' },
      },
      required: ['q'],
    },
  },
  {
    name: 'ml_publicar_producto',
    description:
      'Publica un producto del inventario en MercadoLibre. Requiere el product_template_id y la ' +
      'categoría de ML. El producto debe tener precio configurado.',
    annotations: { title: 'Publicar producto (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        product_template_id: { type: 'string', description: 'UUID del producto a publicar' },
        category_id: { type: 'string', description: 'ID de categoría ML (ej: MLA3530). Usá ml_buscar_categorias.' },
        title: { type: 'string', description: 'Título de la publicación (opcional, default: nombre del producto)' },
        description: { type: 'string', description: 'Descripción (opcional)' },
        brand: { type: 'string', description: 'Marca (opcional, recomendado)' },
        condition: { type: 'string', description: 'new (default) o used' },
        listing_type_id: { type: 'string', description: 'Tipo de publicación: free (default), gold_special, gold_pro, etc.' },
      },
      required: ['product_template_id', 'category_id'],
    },
  },
  {
    name: 'ml_importar_publicaciones',
    description:
      'Importa al ERP todas las publicaciones existentes en la cuenta de MercadoLibre. Vincula por ' +
      'SKU y, si un SKU tiene varias publicaciones, crea variantes diferenciadas por tipo de publicación.',
    annotations: { title: 'Importar publicaciones (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ml_sincronizar_publicaciones',
    description:
      'Empuja stock y precio del ERP hacia MercadoLibre para las publicaciones vinculadas. Si no se ' +
      'especifican productos, sincroniza todas.',
    annotations: { title: 'Sincronizar publicaciones (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        product_ids: { type: 'array', items: { type: 'string' }, description: 'UUIDs de product_template a sincronizar (opcional, default: todas)' },
      },
    },
  },
  {
    name: 'ml_importar_ordenes',
    description: 'Importa las órdenes recientes de MercadoLibre al ERP (crea cliente y orden de venta si están pagas).',
    annotations: { title: 'Importar órdenes (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: 'Fecha desde en ISO (ej: 2026-06-01T00:00:00Z). Opcional.' },
      },
    },
  },
  {
    name: 'ml_responder_pregunta',
    description: 'Responde una pregunta de un comprador en MercadoLibre.',
    annotations: { title: 'Responder pregunta (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        question_id: { type: 'number', description: 'ID de la pregunta en ML' },
        answer_text: { type: 'string', description: 'Texto de la respuesta' },
      },
      required: ['question_id', 'answer_text'],
    },
  },
  {
    name: 'ml_cambiar_estado_publicacion',
    description: 'Pausa, activa o cierra una publicación en MercadoLibre.',
    annotations: { title: 'Cambiar estado de publicación (ML)', readOnlyHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        listing_id: { type: 'string', description: 'UUID de la publicación (listing) en el ERP' },
        status: { type: 'string', description: 'paused, active o closed' },
      },
      required: ['listing_id', 'status'],
    },
  },
];

// ─── Handlers ──────────────────────────────────────────────────────────────────

export async function handleMlGetEstado() {
  const client = getClient();
  try {
    const r = await client.get<Record<string, unknown>>('/api/semilla/mercado-libre/config');
    if (!r?.connected && !r?.app_configured) {
      return { content: [{ type: 'text', text: 'MercadoLibre no está configurado para este tenant (sin credenciales de app ni conexión).' }] };
    }
    const lines = [
      `**MercadoLibre — Estado**`,
      `Conectado: ${r.connected ? 'Sí' : 'No'}`,
      `App configurada: ${r.app_configured ? 'Sí' : 'No'}`,
      r.seller_nickname ? `Vendedor: ${r.seller_nickname}${r.seller_email ? ` (${r.seller_email})` : ''}` : null,
      r.site_id ? `País (site_id): ${r.site_id}` : null,
      r.token_expires_at ? `Token vence: ${r.token_expires_at}` : null,
      typeof r.is_token_expired === 'boolean' ? `Token vencido: ${r.is_token_expired ? 'Sí' : 'No'}` : null,
    ].filter(Boolean);
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  } catch (e) { return errText(e); }
}

export async function handleMlListarPublicaciones(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const data = extractData(await client.get('/api/semilla/mercado-libre/products', {
      limit: Number(args.limit || 50), offset: Number(args.offset || 0),
    }));
    if (!data.length) return { content: [{ type: 'text', text: 'No hay publicaciones de MercadoLibre vinculadas.' }] };
    const rows = data.map((p) => {
      const price = p.ml_price ?? 0;
      return `**${p.ml_title || '—'}** [${p.ml_status || '—'}]\n  Listing: \`${p.id}\` | Ítem ML: ${p.ml_item_code || '—'} | SKU: ${p.sku || '—'}\n  Precio: ${formatCurrency(Number(price))} | Stock: ${p.ml_available_quantity ?? '—'}`;
    });
    return { content: [{ type: 'text', text: `${data.length} publicación(es):\n\n${rows.join('\n\n')}` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlListarOrdenes(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string | number> = { limit: Number(args.limit || 20), offset: Number(args.offset || 0) };
    if (args.status) params.status = String(args.status);
    const data = extractData(await client.get('/api/semilla/mercado-libre/orders', params));
    if (!data.length) return { content: [{ type: 'text', text: 'No hay órdenes de MercadoLibre.' }] };
    const rows = data.map((o) =>
      `**Orden ${o.ml_order_id}** [${o.ml_status || '—'}]\n  Comprador: ${o.buyer_nickname || '—'} | Total: ${formatCurrency(Number(o.total_amount || 0))}\n  Venta vinculada: ${o.sale_order_id ? `\`${o.sale_order_id}\`` : 'no'}`,
    );
    return { content: [{ type: 'text', text: `${data.length} orden(es):\n\n${rows.join('\n\n')}` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlListarPreguntas(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string> = {};
    if (args.status) params.status = String(args.status);
    if (args.ml_item_code) params.ml_item_code = String(args.ml_item_code);
    const data = extractData(await client.get('/api/semilla/mercado-libre/questions', params));
    if (!data.length) return { content: [{ type: 'text', text: 'No hay preguntas.' }] };
    const rows = data.map((q) =>
      `**Pregunta ${q.ml_question_id}** [${q.question_status || '—'}] — ítem ${q.ml_item_code || '—'}\n  ${q.buyer_nickname || 'Comprador'}: ${q.question_text || ''}${q.answer_text ? `\n  Respuesta: ${q.answer_text}` : ''}`,
    );
    return { content: [{ type: 'text', text: `${data.length} pregunta(s):\n\n${rows.join('\n\n')}` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlBuscarCategorias(args: Record<string, unknown>) {
  const client = getClient();
  const q = String(args.q || '').trim();
  if (q.length < 2) return { content: [{ type: 'text', text: 'El texto de búsqueda debe tener al menos 2 caracteres.' }] };
  try {
    const params: Record<string, string> = { q };
    if (args.site_id) params.site_id = String(args.site_id);
    const result = await client.get<Record<string, unknown>>('/api/semilla/mercado-libre/categories/search', params);
    const data = extractData(result);
    const cacheCount = (result as Record<string, unknown>)?.cache_count ?? 0;
    if (!data.length) {
      return { content: [{ type: 'text', text: `Sin resultados para "${q}". Categorías en caché: ${cacheCount}. Si es 0, primero hay que importar las categorías de ML.` }] };
    }
    const rows = data.map((c) => `\`${c.id}\` — ${c.name}${c.full_path ? `  (${c.full_path})` : ''}`);
    return { content: [{ type: 'text', text: rows.join('\n') }] };
  } catch (e) { return errText(e); }
}

export async function handleMlPublicarProducto(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body: Record<string, unknown> = {
      product_template_id: String(args.product_template_id),
      category_id: String(args.category_id),
    };
    for (const k of ['title', 'description', 'brand', 'condition', 'listing_type_id']) {
      if (args[k] !== undefined) body[k] = args[k];
    }
    const r = await client.post<Record<string, unknown>>('/api/semilla/mercado-libre/products/publish', body);
    const d = (r?.data as Record<string, unknown>) || {};
    return { content: [{ type: 'text', text: `Publicado en MercadoLibre.\n  Ítem ML: ${d.ml_item_code || '—'} | Estado: ${d.ml_status || '—'}\n  ${d.ml_permalink || ''}` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlImportarPublicaciones() {
  const client = getClient();
  try {
    const r = await client.post<Record<string, unknown>>('/api/semilla/mercado-libre/products/import', {});
    return { content: [{ type: 'text', text: `Importación completada. Publicaciones: ${r?.imported ?? 0} | Vinculadas a productos: ${r?.linked ?? 0}.` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlSincronizarPublicaciones(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body: Record<string, unknown> = {};
    if (Array.isArray(args.product_ids)) body.product_ids = args.product_ids;
    const r = await client.post<Record<string, unknown>>('/api/semilla/mercado-libre/products/sync', body);
    return { content: [{ type: 'text', text: `Sincronizadas ${r?.synced ?? 0} publicación(es) hacia MercadoLibre.` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlImportarOrdenes(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body: Record<string, unknown> = {};
    if (args.date_from) body.date_from = String(args.date_from);
    const r = await client.post<Record<string, unknown>>('/api/semilla/mercado-libre/orders/sync', body);
    return { content: [{ type: 'text', text: `Importadas ${r?.imported ?? 0} orden(es) de MercadoLibre.` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlResponderPregunta(args: Record<string, unknown>) {
  const client = getClient();
  try {
    await client.post(`/api/semilla/mercado-libre/questions/${Number(args.question_id)}/answer`, {
      answer_text: String(args.answer_text),
    });
    return { content: [{ type: 'text', text: `Pregunta ${args.question_id} respondida.` }] };
  } catch (e) { return errText(e); }
}

export async function handleMlCambiarEstadoPublicacion(args: Record<string, unknown>) {
  const client = getClient();
  const status = String(args.status);
  if (!['paused', 'active', 'closed'].includes(status)) {
    return { content: [{ type: 'text', text: 'status debe ser paused, active o closed.' }] };
  }
  try {
    await client.patch(`/api/semilla/mercado-libre/products/${String(args.listing_id)}/ml-status`, { status });
    return { content: [{ type: 'text', text: `Publicación ${args.listing_id} → ${status}.` }] };
  } catch (e) { return errText(e); }
}
