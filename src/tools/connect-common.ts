/**
 * Tools de Semilla Connect — comunes a TODOS los roles (specialist, merchant, gym, consumer).
 *
 *   - Posts (feed): listar míos, crear, eliminar, like/unlike, comentar.
 *   - Notificaciones: listar, marcar como leída, marcar todas.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectClient,
  unwrapConnect,
  unwrapConnectArray,
  extractAuthOverrides,
} from '../connect-client.js';

const userIdProp = {
  user_id: { type: 'string', description: 'UUID del usuario. Opcional — se resuelve del JWT si se omite.' },
};

export const connectCommonTools: Tool[] = [
  // Posts
  {
    name: 'connect_posts_list_mine',
    description: 'Lista los posts del usuario actual (su feed propio).',
    annotations: { title: 'Mis publicaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        limit: { type: 'number', default: 20 },
        offset: { type: 'number', default: 0 },
      },
      required: [],
    },
  },
  {
    name: 'connect_posts_create',
    description: 'Crea un post en el feed del usuario. Acepta texto, imágenes y opcionalmente marcarlo como historia (24h).',
    annotations: { title: 'Crear publicación', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        content: { type: 'string', description: 'Texto del post.' },
        image_urls: { type: 'array', items: { type: 'string' }, description: 'URLs de imágenes.' },
        channel_id: { type: 'string', description: 'UUID del canal (opcional).' },
        is_story: { type: 'boolean', description: 'Si true, expira en 24h.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'connect_posts_update',
    description: 'Actualiza un post propio (contenido, imágenes, canal).',
    annotations: { title: 'Editar publicación', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del post.' },
        content: { type: 'string', description: 'Nuevo texto del post.' },
        image_urls: { type: 'array', items: { type: 'string' }, description: 'Nuevas URLs de imágenes.' },
        channel_id: { type: 'string', description: 'Nuevo canal.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_posts_delete',
    description: 'Elimina un post propio.',
    annotations: { title: 'Eliminar publicación', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del post.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_posts_list_comments',
    description: 'Lista los comentarios de un post.',
    annotations: { title: 'Comentarios de la publicación', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del post.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_posts_like',
    description: 'Da like a un post.',
    annotations: { title: 'Dar like', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del post.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_posts_unlike',
    description: 'Quita el like de un post.',
    annotations: { title: 'Quitar like', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del post.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_posts_comment',
    description: 'Comenta un post.',
    annotations: { title: 'Comentar publicación', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del post.' },
        content: { type: 'string', description: 'Texto del comentario.' },
        parent_comment_id: { type: 'string', description: 'UUID del comentario padre si es respuesta.' },
      },
      required: ['id', 'content'],
    },
  },

  // Feed público de posts
  {
    name: 'connect_posts_feed_public',
    description:
      'Devuelve el feed público de posts de Semilla Connect (todos los autores). Útil para recomendar contenido al usuario o para listar las últimas publicaciones de la comunidad. No requiere autenticación de autor.',
    annotations: { title: 'Feed público', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        limit: { type: 'number', description: 'Cantidad de posts a devolver (default 50, máximo recomendado 100).', default: 50 },
        offset: { type: 'number', description: 'Offset de paginación.', default: 0 },
        channel_id: { type: 'string', description: 'UUID del canal para filtrar (opcional).' },
      },
      required: [],
    },
  },

  // Perfil público de usuario por username
  {
    name: 'connect_users_get_by_username',
    description:
      'Devuelve el perfil público de un usuario por su @username, junto con los datos del comercio, gimnasio o profesional (health_provider) asociado si los tiene. Útil para obtener el perfil de cualquier usuario (consumidor, comercio, especialista) a partir del username visible en la UI.',
    annotations: { title: 'Ver perfil por usuario', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        username: { type: 'string', description: 'Username del usuario (sin @).' },
      },
      required: ['username'],
    },
  },

  // Cobro genérico transversal a cualquier vertical
  {
    name: 'connect_payments_charge_generic',
    description:
      'Crea un cobro de Mercado Pago genérico para cualquier vertical (comercio, gimnasio, especialista, etc). A diferencia de connect_payments_create_appointment_charge y connect_payments_create_order_charge — que son shortcuts atados a un turno o a una orden de restaurante — esta tool acepta merchant_kind + merchant_id + amount + description arbitrarios. Devuelve init_point para que el pagador abra el checkout.',
    annotations: { title: 'Generar cobro genérico', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        merchant_kind: {
          type: 'string',
          description: 'Tipo de comercio: gym | merchant | specialist | tenant.',
          enum: ['gym', 'merchant', 'specialist', 'tenant'],
        },
        merchant_id: { type: 'string', description: 'UUID del merchant_profile / specialist_profile / tenant que cobra.' },
        vertical: {
          type: 'string',
          description: 'Vertical del cobro (ej: gym, retail, health, gastronomy, hospitality, generic). Requerido por el backend.',
        },
        amount: { type: 'number', description: 'Monto a cobrar, > 0.' },
        currency: { type: 'string', description: 'Moneda ISO (default ARS).' },
        description: { type: 'string', description: 'Descripción del cobro (visible para el pagador).' },
        context_kind: { type: 'string', description: 'Tipo de contexto opcional (ej: appointment, order, subscription).' },
        context_id: { type: 'string', description: 'ID del contexto opcional (UUID del turno/orden/etc).' },
        payer_email: { type: 'string', description: 'Email del pagador (opcional).' },
        payer_name: { type: 'string', description: 'Nombre del pagador (opcional).' },
        tenant_id: { type: 'string', description: 'tenant_id del comercio si aplica (opcional).' },
        expires_in_hours: { type: 'number', description: 'Horas de expiración del link (opcional).' },
        metadata: { type: 'object', description: 'Metadata libre adjunta al cobro.' },
      },
      required: ['merchant_kind', 'merchant_id', 'vertical', 'amount', 'description'],
    },
  },

  // Notificaciones
  {
    name: 'connect_notifications_list',
    description: 'Lista las notificaciones internas del usuario en Semilla Connect.',
    annotations: { title: 'Listar notificaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: { ...userIdProp }, required: [] },
  },
  {
    name: 'connect_notifications_mark_read',
    description: 'Marca una notificación como leída.',
    annotations: { title: 'Marcar notificación leída', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID de la notificación.' } },
      required: ['id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Posts

export async function handlePostsListMine(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const userId = client.resolveUserId(auth.userId);
  const params: Record<string, string | number | undefined> = {
    author_id: userId,
    limit: args.limit ? Number(args.limit) : 20,
    offset: args.offset ? Number(args.offset) : 0,
  };
  const result = await client.get<unknown>('/api/shared/posts', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No tenés posts.' }] };
  const rows = items.map((p) => {
    const text = String(p.content || '').slice(0, 100);
    const likes = Number(p.likes_count ?? 0);
    return `- _${p.created_at}_ ${text}${likes > 0 ? ` | ❤ ${likes}` : ''} \`${p.id}\``;
  });
  return { content: [{ type: 'text', text: `## Mis posts (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handlePostsCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = {
    content: args.content,
    image_urls: args.image_urls,
    channel_id: args.channel_id,
    is_story: args.is_story,
  };
  const result = await client.post<any>('/api/shared/posts', body, { userId: auth.userId });
  const data = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Post creado\n\n- **ID:** \`${data?.id || result?.id || '—'}\``,
    }],
  };
}

export async function handlePostsUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of ['content', 'image_urls', 'channel_id']) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>(`/api/shared/posts/${encodeURIComponent(id)}`, body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Post actualizado\n\n- **ID:** \`${id}\`` }] };
}

export async function handlePostsDelete(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.del<unknown>(`/api/shared/posts/${encodeURIComponent(id)}`, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Post eliminado\n\n- **ID:** \`${id}\`` }] };
}

export async function handlePostsListComments(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<unknown>(
    `/api/shared/posts/${encodeURIComponent(id)}/comments`,
    { userId: auth.userId },
  );
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay comentarios.' }] };
  const rows = items.map((c) => {
    const author = (c.author_info as any)?.name || c.author_id || '—';
    const text = String(c.content || '').slice(0, 100);
    return `- _${c.created_at}_ **${author}**: ${text} \`${c.id}\``;
  });
  return { content: [{ type: 'text', text: `## Comentarios (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handlePostsLike(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(`/api/shared/posts/${encodeURIComponent(id)}/like`, {}, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Like dado\n\n- **Post:** \`${id}\`` }] };
}

export async function handlePostsUnlike(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.del<unknown>(`/api/shared/posts/${encodeURIComponent(id)}/like`, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Like quitado\n\n- **Post:** \`${id}\`` }] };
}

export async function handlePostsComment(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(
    `/api/shared/posts/${encodeURIComponent(id)}/comments`,
    { content: args.content, parent_comment_id: args.parent_comment_id || undefined },
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Comentario agregado\n\n- **Post:** \`${id}\`` }] };
}

// Notificaciones

export async function handleConnectNotificationsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<unknown>('/api/shared/notifications', { userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay notificaciones.' }] };
  const rows = items.map((n) => {
    const flag = n.is_read ? 'leída' : 'no leída';
    return `- _${n.created_at}_ **${n.title}** (${n.type}) — ${flag} \`${n.id}\``;
  });
  return { content: [{ type: 'text', text: `## Notificaciones Connect (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleConnectNotificationsMarkRead(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(
    `/api/shared/notifications/${encodeURIComponent(id)}/read`,
    {},
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Notificación marcada como leída\n\n- **ID:** \`${id}\`` }] };
}

// Feed público de posts (todos los autores)
export async function handlePostsFeedPublic(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | number | undefined> = {
    limit: args.limit ? Number(args.limit) : 50,
    offset: args.offset ? Number(args.offset) : 0,
    channel_id: args.channel_id ? String(args.channel_id) : undefined,
  };
  const result = await client.get<unknown>('/api/shared/posts', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay posts en el feed público.' }] };
  const rows = items.map((p) => {
    const author = (p.author_info as any)?.name || (p.author_info as any)?.username || p.author_id || '—';
    const text = String(p.content || '').slice(0, 100);
    const likes = Number(p.likes_count ?? 0);
    const comments = Number(p.comments_count ?? 0);
    const meta: string[] = [];
    if (likes > 0) meta.push(`${likes} like(s)`);
    if (comments > 0) meta.push(`${comments} coment.`);
    const metaStr = meta.length ? ` | ${meta.join(' · ')}` : '';
    return `- _${p.created_at}_ **${author}**: ${text}${metaStr} \`${p.id}\``;
  });
  return { content: [{ type: 'text', text: `## Feed público (${items.length})\n\n${rows.join('\n')}` }] };
}

// Perfil público de usuario por username
export async function handleUsersGetByUsername(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const username = String(args.username || '').replace(/^@/, '').trim();
  if (!username) {
    return { content: [{ type: 'text', text: 'Falta el parámetro `username`.' }] };
  }
  const result = await client.get<any>(
    `/api/shared/users/by-username/${encodeURIComponent(username)}`,
    { userId: auth.userId },
  );
  // El endpoint devuelve { success, user, health_provider, gym, merchant } directo (no anidado bajo data).
  const user = (result?.user || (result?.data as any)?.user) as Record<string, unknown> | undefined;
  if (!user) {
    return { content: [{ type: 'text', text: `No se encontró el usuario \`${username}\`.` }] };
  }
  const healthProvider = (result?.health_provider || (result?.data as any)?.health_provider) as Record<string, unknown> | null;
  const gym = (result?.gym || (result?.data as any)?.gym) as Record<string, unknown> | null;
  const merchant = (result?.merchant || (result?.data as any)?.merchant) as Record<string, unknown> | null;

  const lines: string[] = [
    `## Perfil de @${user.username || username}`,
    '',
    `- **ID:** \`${user.id}\``,
    `- **Nombre:** ${user.name || '—'}`,
    `- **Rol:** ${user.user_role || '—'}`,
    `- **Seguidores:** ${user.follower_count ?? 0}`,
  ];
  if (user.bio) lines.push(`- **Bio:** ${user.bio}`);
  if (healthProvider) {
    lines.push('', '### Perfil profesional', `- **Nombre:** ${healthProvider.name}`, `- **Slug:** ${healthProvider.slug}`, `- **ID:** \`${healthProvider.id}\``);
  }
  if (merchant) {
    lines.push('', '### Comercio', `- **Nombre:** ${merchant.name}`, `- **Slug:** ${merchant.slug}`, `- **Categoría:** ${merchant.category || '—'}`, `- **ID:** \`${merchant.id}\``);
  }
  if (gym) {
    lines.push('', '### Gimnasio', `- **Nombre:** ${gym.name}`, `- **Slug:** ${gym.slug}`, `- **ID:** \`${gym.id}\``);
  }
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

// Cobro genérico transversal
export async function handlePaymentsChargeGeneric(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = {
    merchant_kind: args.merchant_kind,
    merchant_id: args.merchant_id,
    vertical: args.vertical,
    amount: Number(args.amount),
    description: args.description,
  };
  if (args.currency !== undefined) body.currency = args.currency;
  if (args.context_kind !== undefined) body.context_kind = args.context_kind;
  if (args.context_id !== undefined) body.context_id = args.context_id;
  if (args.payer_email !== undefined) body.payer_email = args.payer_email;
  if (args.payer_name !== undefined) body.payer_name = args.payer_name;
  if (args.tenant_id !== undefined) body.tenant_id = args.tenant_id;
  if (args.expires_in_hours !== undefined) body.expires_in_hours = Number(args.expires_in_hours);
  if (args.metadata !== undefined) body.metadata = args.metadata;

  const result = await client.post<any>('/api/payments/charge', body, { userId: auth.userId });
  const data = unwrapConnect<Record<string, unknown>>(result) as Record<string, unknown>;
  const payload = (data && Object.keys(data).length ? data : result) as Record<string, unknown>;
  const initPoint = payload?.init_point || payload?.checkout_url || payload?.payment_url || '—';
  const chargeId = payload?.id || payload?.charge_id || payload?.payment_link_id || '—';
  return {
    content: [{
      type: 'text',
      text:
        `## Cobro creado\n\n` +
        `- **ID:** \`${chargeId}\`\n` +
        `- **Monto:** ${payload?.amount ?? body.amount} ${payload?.currency || body.currency || 'ARS'}\n` +
        `- **URL de pago:** ${initPoint}\n` +
        `- **Estado:** ${payload?.status || 'pending'}`,
    }],
  };
}
