/**
 * Tools de Notificaciones para Semilla MCP.
 * Endpoints: /api/semilla/notifications
 *
 * Bandeja unificada del usuario: lista, marca como leído, configura preferencias por evento.
 * Todos los endpoints requieren JWT (Authorization: Bearer) y respetan el tenant del usuario.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap } from '../client.js';

export const notificationsTools: Tool[] = [
  {
    name: 'notifications_list',
    description:
      'Lista las notificaciones del usuario actual de Semilla. Permite filtrar por no leídas y por tipos de evento. ' +
      'Devuelve también el total y los datos de paginación.',
    annotations: { title: 'Listar notificaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        unread: {
          type: 'boolean',
          description: 'Si es true devuelve solo las no leídas. Default: false (todas).',
          default: false,
        },
        event_type: {
          type: 'string',
          description:
            'Tipos de evento a filtrar separados por coma. Ej: "chatter.mention,activity.assigned". ' +
            'Opcional — sin esto devuelve todos los tipos.',
        },
        page: { type: 'number', default: 1 },
        limit: { type: 'number', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'notifications_unread_count',
    description: 'Devuelve la cantidad de notificaciones no leídas del usuario actual.',
    annotations: { title: 'Contar notificaciones sin leer', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'notifications_mark_read',
    description: 'Marca una notificación específica como leída. Idempotente — si ya estaba leída no falla.',
    annotations: { title: 'Marcar notificación como leída', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'UUID de la notificación a marcar como leída.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'notifications_mark_all_read',
    description: 'Marca todas las notificaciones no leídas del usuario como leídas. Devuelve cuántas se actualizaron.',
    annotations: { title: 'Marcar todas como leídas', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'notifications_get_preferences',
    description:
      'Lista todas las preferencias de notificación del usuario por tipo de evento. Devuelve para cada evento ' +
      'si está activado el canal in-app y el canal email. Los valores no configurados explícitamente usan ' +
      'los defaults (in-app y email habilitados).',
    annotations: { title: 'Ver preferencias de notificación', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'notifications_update_preferences',
    description:
      'Actualiza en bulk las preferencias de notificación del usuario. Para cada item se setea si ' +
      'recibe ese evento por in-app y/o email. Solo se modifican los items pasados — el resto queda igual.',
    annotations: { title: 'Actualizar preferencias de notificación', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array de preferencias a actualizar (al menos uno).',
          items: {
            type: 'object',
            properties: {
              event_type: {
                type: 'string',
                description:
                  'Tipo de evento. Ej: chatter.mention, chatter.record_updated, activity.assigned, ' +
                  'activity.due, invoice.overdue, subscription.expiring, stock.low, arca.approved, arca.rejected.',
              },
              in_app_enabled: { type: 'boolean', description: 'Recibir notificación en la bandeja del sistema.' },
              email_enabled:  { type: 'boolean', description: 'Recibir notificación por email.' },
            },
            required: ['event_type', 'in_app_enabled', 'email_enabled'],
          },
        },
      },
      required: ['items'],
    },
  },
];

// ─── Helpers de formato ───────────────────────────────────────────────────────

function renderNotificationRow(n: Record<string, unknown>): string {
  const fecha = formatDate(String(n.created_at || ''));
  const titulo = String(n.title || '—');
  const evento = String(n.event_type || '—');
  const leida = n.read_at ? '✅' : '🔵';
  const cuerpo = n.body ? String(n.body).slice(0, 140) : '';
  const url = n.action_url ? `\n   → ${String(n.action_url)}` : '';
  return (
    `${leida} **${titulo}** _(${evento})_\n` +
    `   ${fecha}` +
    (cuerpo ? `\n   ${cuerpo}` : '') +
    url +
    `\n   \`${n.id}\``
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleNotificationsList(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string | number | boolean | undefined> = {
      page: Number(args.page || 1),
      limit: Number(args.limit || 20),
    };
    if (args.unread === true) params.unread = true;
    if (args.event_type) params.event_type = String(args.event_type);

    const result = await client.get<unknown>('/api/semilla/notifications', params);
    const data = unwrap<{ items?: Record<string, unknown>[]; total?: number; page?: number; limit?: number }>(result);

    const items = Array.isArray(data?.items) ? data.items : [];
    const total = Number(data?.total ?? items.length);

    if (!items.length) {
      return {
        content: [{
          type: 'text',
          text: 'No hay notificaciones que coincidan con los filtros.',
        }],
      };
    }

    const rows = items.map(renderNotificationRow);
    return {
      content: [{
        type: 'text',
        text:
          `## Notificaciones (${items.length} de ${total})\n\n` +
          `Página ${data?.page ?? 1} · Límite ${data?.limit ?? items.length}\n\n` +
          rows.join('\n\n'),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al listar notificaciones: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleNotificationsUnreadCount(_args: Record<string, unknown>) {
  const client = getClient();
  try {
    const result = await client.get<unknown>('/api/semilla/notifications/unread-count');
    const data = unwrap<{ count?: number }>(result);
    const count = Number(data?.count ?? 0);

    return {
      content: [{
        type: 'text',
        text: count === 0
          ? '✅ No tenés notificaciones sin leer.'
          : `🔵 Tenés **${count}** notificación${count === 1 ? '' : 'es'} sin leer.`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al obtener contador: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleNotificationsMarkRead(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.id || '').trim();
  if (!id) {
    return {
      content: [{ type: 'text', text: '❌ Falta el parámetro `id` de la notificación.' }],
      isError: true,
    };
  }
  try {
    const result = await client.post<unknown>(
      `/api/semilla/notifications/${encodeURIComponent(id)}/read`,
      {}
    );
    const data = unwrap<{ id?: string; read?: boolean; already_read?: boolean }>(result);
    const yaEstaba = data?.already_read === true;

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Notificación marcada como leída\n\n` +
          `- **ID:** \`${id}\`\n` +
          (yaEstaba ? '- Ya estaba marcada previamente.' : '- Marcada en esta llamada.'),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al marcar como leída: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleNotificationsMarkAllRead(_args: Record<string, unknown>) {
  const client = getClient();
  try {
    const result = await client.post<unknown>('/api/semilla/notifications/mark-all-read', {});
    const data = unwrap<{ updated?: number }>(result);
    const updated = Number(data?.updated ?? 0);

    return {
      content: [{
        type: 'text',
        text:
          updated === 0
            ? '✅ No había notificaciones sin leer.'
            : `## ✅ Todas marcadas como leídas\n\n- **Actualizadas:** ${updated}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al marcar todas como leídas: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleNotificationsGetPreferences(_args: Record<string, unknown>) {
  const client = getClient();
  try {
    const result = await client.get<unknown>('/api/semilla/notifications/preferences');
    const data = unwrap<{ items?: Record<string, unknown>[] }>(result);
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!items.length) {
      return { content: [{ type: 'text', text: 'No hay preferencias configuradas.' }] };
    }

    // Agrupar por `group`
    const byGroup = new Map<string, Record<string, unknown>[]>();
    for (const it of items) {
      const g = String(it.group || 'Otros');
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(it);
    }

    const sections: string[] = [];
    for (const [grupo, rows] of byGroup) {
      const lines = rows.map((r) => {
        const inApp = r.in_app_enabled ? '✅' : '⛔';
        const email = r.email_enabled ? '✅' : '⛔';
        return `- **${r.label || r.event_type}** \`${r.event_type}\` · In-app ${inApp} · Email ${email}`;
      });
      sections.push(`### ${grupo}\n\n${lines.join('\n')}`);
    }

    return {
      content: [{
        type: 'text',
        text: `## Preferencias de notificación\n\n${sections.join('\n\n')}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al obtener preferencias: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleNotificationsUpdatePreferences(args: Record<string, unknown>) {
  const client = getClient();
  const items = Array.isArray(args.items) ? args.items : [];

  if (!items.length) {
    return {
      content: [{ type: 'text', text: '❌ Tenés que pasar al menos un item en `items[]`.' }],
      isError: true,
    };
  }

  // Limpiar y validar items
  const clean = items
    .map((it: any) => ({
      event_type: String(it?.event_type || '').trim(),
      in_app_enabled: it?.in_app_enabled === true,
      email_enabled: it?.email_enabled === true,
    }))
    .filter((it) => it.event_type.length > 0);

  if (!clean.length) {
    return {
      content: [{ type: 'text', text: '❌ Ningún item tiene `event_type` válido.' }],
      isError: true,
    };
  }

  try {
    const result = await client.request<unknown>('/api/semilla/notifications/preferences', {
      method: 'PUT',
      body: { items: clean },
    });
    const data = unwrap<{ updated?: number }>(result);
    const updated = Number(data?.updated ?? clean.length);

    const detalle = clean
      .map((it) => `- \`${it.event_type}\` · In-app ${it.in_app_enabled ? '✅' : '⛔'} · Email ${it.email_enabled ? '✅' : '⛔'}`)
      .join('\n');

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Preferencias actualizadas\n\n` +
          `**Items actualizados:** ${updated}\n\n${detalle}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al actualizar preferencias: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}
