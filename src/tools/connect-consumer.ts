/**
 * Tools de Semilla Connect — modo CONSUMIDOR (paciente / cliente final).
 *
 * Operaciones que un usuario final realiza sobre la red de profesionales:
 *   - Reservar / cancelar / listar turnos.
 *   - Buscar especialistas y negocios.
 *   - Listar restaurantes, ver menú, crear órdenes.
 *   - Pagar turnos y órdenes vía Mercado Pago / Semilla Pay.
 *   - Conversar con negocios.
 *
 * Todos los tools usan `x-api-key` (compartida) + `x-user-id` (del usuario actual).
 * El user_id se resuelve del JWT del ERP por defecto; se puede sobrescribir
 * pasando `user_id` en los argumentos.
 *
 * Endpoints backend: semilla-connect-shared bajo /api/shared/* y /api/connect/*.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectClient,
  unwrapConnect,
  unwrapConnectArray,
  extractAuthOverrides,
} from '../connect-client.js';

// ─── Schemas reutilizables ────────────────────────────────────────────────────

const userIdProp = {
  user_id: {
    type: 'string',
    description:
      'UUID del usuario consumidor que ejecuta la acción. Opcional — si se omite se ' +
      'resuelve del JWT del ERP o de SEMILLA_CONNECT_USER_ID.',
  },
};

// ─── Definiciones de tools ────────────────────────────────────────────────────

export const connectConsumerTools: Tool[] = [
  // Turnos
  {
    name: 'connect_consumer_appointments_book',
    description:
      'Reserva un turno con un especialista o negocio en Semilla Connect. Requiere especialista o ' +
      'negocio, fecha/hora de inicio y opcionalmente un servicio. Devuelve la cita creada con su id.',
    annotations: { title: 'Reservar turno', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del especialista.' },
        business_id: { type: 'string', description: 'UUID del negocio (alternativa a specialist_id).' },
        service_id: { type: 'string', description: 'UUID del servicio reservado (opcional).' },
        scheduled_start: { type: 'string', description: 'Fecha y hora de inicio en ISO 8601 (ej: 2026-06-12T15:30:00).' },
        scheduled_end: { type: 'string', description: 'Fecha y hora de fin (opcional, se infiere de duration_minutes).' },
        duration_minutes: { type: 'number', description: 'Duración en minutos (opcional).' },
        notes: { type: 'string', description: 'Comentarios adicionales para el especialista.' },
        patient_name: { type: 'string', description: 'Nombre del paciente si difiere del usuario logueado.' },
        patient_phone: { type: 'string', description: 'Teléfono de contacto.' },
        patient_email: { type: 'string', description: 'Email de contacto.' },
      },
      required: ['scheduled_start'],
    },
  },
  {
    name: 'connect_consumer_appointments_list_mine',
    description:
      'Lista los turnos del usuario consumidor. Permite filtrar por rango de fechas y por estado.',
    annotations: { title: 'Mis turnos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        from: { type: 'string', description: 'Fecha desde (YYYY-MM-DD).' },
        to: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD).' },
        status: { type: 'string', description: 'Estado: pending_payment, booked, confirmed, cancelled, completed.' },
      },
      required: [],
    },
  },
  {
    name: 'connect_consumer_appointments_cancel',
    description: 'Cancela un turno del usuario consumidor por su id.',
    annotations: { title: 'Cancelar turno', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del turno a cancelar.' },
        reason: { type: 'string', description: 'Motivo de la cancelación (opcional).' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_availability_get_slots',
    description:
      'Devuelve los slots de disponibilidad de un especialista en una fecha dada. ' +
      'Útil para mostrarle al usuario qué horarios puede reservar.',
    annotations: { title: 'Disponibilidad de turnos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del especialista.' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
        duration_min: { type: 'number', description: 'Duración del servicio en minutos. Default 30.', default: 30 },
      },
      required: ['specialist_id', 'date'],
    },
  },

  // Restaurantes (públicos)
  {
    name: 'connect_restaurants_search',
    description:
      'Busca restaurantes en Semilla Connect por nombre o por geolocalización. Endpoint público — no requiere ' +
      'user_id pero igual lo enviamos para personalización.',
    annotations: { title: 'Buscar restaurantes', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        q: { type: 'string', description: 'Texto libre de búsqueda.' },
        lat: { type: 'number', description: 'Latitud para búsqueda geográfica.' },
        lng: { type: 'number', description: 'Longitud para búsqueda geográfica.' },
        radius_km: { type: 'number', description: 'Radio en km. Default 5.', default: 5 },
        limit: { type: 'number', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'connect_restaurants_get',
    description:
      'Devuelve el detalle público de un restaurante por su slug (datos del perfil gastronómico).',
    annotations: { title: 'Ver restaurante', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        slug: { type: 'string', description: 'Slug del restaurante.' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'connect_restaurants_get_menu',
    description: 'Devuelve el menú de un restaurante por su slug, agrupado por categoría.',
    annotations: { title: 'Ver menú del restaurante', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        slug: { type: 'string', description: 'Slug del restaurante.' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'connect_restaurants_create_order',
    description:
      'Crea una orden de comida en un restaurante. Acepta dine_in, takeaway o delivery. ' +
      'Devuelve el token público para tracking y el id de la orden.',
    annotations: { title: 'Crear pedido de comida', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        slug: { type: 'string', description: 'Slug del restaurante.' },
        items: {
          type: 'array',
          description: 'Líneas de la orden.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              quantity: { type: 'number' },
              notes: { type: 'string' },
            },
            required: ['product_id', 'quantity'],
          },
        },
        table_id: { type: 'string', description: 'UUID de la mesa (solo dine_in).' },
        type: { type: 'string', enum: ['dine_in', 'takeaway', 'delivery'], description: 'Modalidad de la orden.' },
        notes: { type: 'string', description: 'Notas generales.' },
        customer_name: { type: 'string' },
        customer_phone: { type: 'string' },
      },
      required: ['slug', 'items'],
    },
  },
  {
    name: 'connect_orders_get_status',
    description: 'Devuelve el estado actual de una orden por su token público.',
    annotations: { title: 'Estado del pedido', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        token: { type: 'string', description: 'Token público de la orden.' },
      },
      required: ['token'],
    },
  },

  // Especialistas y negocios
  {
    name: 'connect_specialists_search',
    description: 'Busca especialistas por especialidad, nombre o geolocalización.',
    annotations: { title: 'Buscar especialistas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialty: { type: 'string', description: 'Filtrar por especialidad (ej: "dentista").' },
        q: { type: 'string', description: 'Texto libre.' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        radius_km: { type: 'number', default: 10 },
        limit: { type: 'number', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'connect_businesses_search',
    description:
      'Busca negocios (merchants) por texto, categoría, tipo de negocio o geolocalización. ' +
      'Usa el endpoint dedicado /api/shared/merchants/search con ranking y paginado. ' +
      'Devuelve hasta 50 resultados por página.',
    annotations: { title: 'Buscar negocios', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        q: { type: 'string', description: 'Texto libre — busca en nombre, descripción y slug.' },
        category: { type: 'string', description: 'Categoría libre (ej: "panadería", "florería").' },
        business_type: {
          type: 'string',
          enum: ['specialist', 'merchant', 'gym', 'center', 'restaurant'],
          description: 'Tipo de negocio.',
        },
        lat: { type: 'number', description: 'Latitud para búsqueda geográfica.' },
        lng: { type: 'number', description: 'Longitud para búsqueda geográfica.' },
        radius_km: { type: 'number', description: 'Radio en km. Default 5.', default: 5 },
        limit: { type: 'number', description: 'Resultados por página (max 50).', default: 20 },
        offset: { type: 'number', description: 'Offset para paginado.', default: 0 },
      },
      required: [],
    },
  },

  {
    name: 'connect_specialists_get',
    description:
      'Devuelve el detalle público de un especialista por el id del perfil (specialist_profiles.id).',
    annotations: { title: 'Ver especialista', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del perfil de especialista.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialists_list_reviews',
    description: 'Lista las reseñas del especialista ordenadas por fecha descendente.',
    annotations: { title: 'Reseñas del especialista', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista.' },
      },
      required: ['specialist_id'],
    },
  },
  {
    name: 'connect_specialists_create_review',
    description:
      'Crea una reseña pública sobre un especialista. Requiere nombre del autor y rating general (1-5). ' +
      'Acepta sub-ratings opcionales de trato, puntualidad, diagnóstico y explicación.',
    annotations: { title: 'Crear reseña de especialista', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista.' },
        author_name: { type: 'string', description: 'Nombre visible del autor de la reseña.' },
        rating_overall: { type: 'number', description: 'Rating general 1-5.' },
        rating_trato: { type: 'number' },
        rating_puntualidad: { type: 'number' },
        rating_diagnostico: { type: 'number' },
        rating_explicacion: { type: 'number' },
        comment: { type: 'string', description: 'Texto de la reseña.' },
      },
      required: ['specialist_id', 'author_name', 'rating_overall'],
    },
  },
  {
    name: 'connect_businesses_get',
    description:
      'Devuelve el detalle de un negocio por id o por slug. Si se pasa `id` busca en /api/shared/businesses/:id; ' +
      'si se pasa `slug` busca en /api/shared/merchants/:slug (perfil del merchant).',
    annotations: { title: 'Ver negocio', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del negocio (alternativa a slug).' },
        slug: { type: 'string', description: 'Slug del comercio (alternativa a id).' },
      },
      required: [],
    },
  },
  {
    name: 'connect_users_follow',
    description: 'El usuario actual sigue a otro usuario por su UUID. Idempotente.',
    annotations: { title: 'Seguir usuario', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        target_user_id: { type: 'string', description: 'UUID del usuario al que seguir.' },
      },
      required: ['target_user_id'],
    },
  },
  {
    name: 'connect_users_unfollow',
    description: 'El usuario actual deja de seguir a otro usuario. Idempotente.',
    annotations: { title: 'Dejar de seguir usuario', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        target_user_id: { type: 'string', description: 'UUID del usuario a dejar de seguir.' },
      },
      required: ['target_user_id'],
    },
  },

  // Pagos (MP / Semilla Pay)
  {
    name: 'connect_payments_create_appointment_charge',
    description:
      'Genera un link de pago de Mercado Pago para un turno reservado. El monto y la descripción los ' +
      'resuelve el backend a partir del turno; el caller solo necesita el appointment_id. Devuelve ' +
      'init_point (URL de checkout) que el usuario debe abrir para pagar.',
    annotations: { title: 'Generar cobro de turno', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        appointment_id: { type: 'string', description: 'UUID del turno a cobrar.' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'connect_payments_create_order_charge',
    description:
      'Crea una orden de restaurante y genera el link de pago de Mercado Pago en una sola operación. ' +
      'Usa el slug del restaurante y la lista de items. Si el restaurante no tiene MP conectado, ' +
      'devuelve la orden sin link (mp_preference_url=null) para pago presencial.',
    annotations: { title: 'Generar cobro de pedido', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        restaurant_slug: { type: 'string', description: 'Slug del restaurante.' },
        customer_name: { type: 'string', description: 'Nombre del cliente que paga.' },
        customer_email: { type: 'string', description: 'Email de contacto del cliente (opcional).' },
        lines: {
          type: 'array',
          description: 'Items del pedido.',
          items: {
            type: 'object',
            properties: {
              dish_id: { type: 'string' },
              qty: { type: 'number' },
              modifiers: { type: 'array', items: { type: 'object' } },
            },
            required: ['dish_id', 'qty'],
          },
        },
        table_token: { type: 'string', description: 'Token de mesa (dine-in, opcional).' },
      },
      required: ['restaurant_slug', 'customer_name', 'lines'],
    },
  },
  {
    name: 'connect_payments_get_status',
    description: 'Devuelve el estado de un cobro por su charge_id.',
    annotations: { title: 'Estado del cobro', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        charge_id: { type: 'string', description: 'Identificador del cobro / pago.' },
      },
      required: ['charge_id'],
    },
  },
  {
    name: 'connect_payments_regenerate_appointment_link',
    description:
      'Regenera el link de pago de un turno (útil cuando expiró el checkout original). ' +
      'Devuelve una nueva URL de Mercado Pago.',
    annotations: { title: 'Regenerar link de pago', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        appointment_id: { type: 'string', description: 'UUID del turno.' },
      },
      required: ['appointment_id'],
    },
  },

  // Chats
  {
    name: 'connect_chats_list',
    description: 'Lista las conversaciones del usuario consumidor con negocios y especialistas.',
    annotations: { title: 'Listar conversaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
  {
    name: 'connect_chats_list_messages',
    description: 'Devuelve los mensajes de una conversación. Permite polling con `since`.',
    annotations: { title: 'Ver mensajes del chat', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        conversation_id: { type: 'string', description: 'UUID de la conversación.' },
        since: { type: 'string', description: 'ISO timestamp para polling incremental (opcional).' },
      },
      required: ['conversation_id'],
    },
  },
  {
    name: 'connect_chats_send_message',
    description: 'Envía un mensaje de texto en una conversación.',
    annotations: { title: 'Enviar mensaje', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        conversation_id: { type: 'string', description: 'UUID de la conversación.' },
        text: { type: 'string', description: 'Contenido del mensaje.' },
      },
      required: ['conversation_id', 'text'],
    },
  },
  {
    name: 'connect_chats_create_with_business',
    description:
      'Abre una conversación con un negocio (idempotente — si ya existe, devuelve la existente). ' +
      'Permite mandar un primer mensaje.',
    annotations: { title: 'Abrir chat con negocio', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        business_id: { type: 'string', description: 'UUID del negocio.' },
        initial_message: { type: 'string', description: 'Primer mensaje opcional.' },
      },
      required: ['business_id'],
    },
  },
  {
    name: 'connect_chats_get_conversation',
    description:
      'Devuelve el detalle de una conversación por id (participantes, último mensaje, contadores).',
    annotations: { title: 'Ver conversación', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        conversation_id: { type: 'string', description: 'UUID de la conversación.' },
      },
      required: ['conversation_id'],
    },
  },
  {
    name: 'connect_chats_mark_read',
    description: 'Marca todos los mensajes de una conversación como leídos por el usuario actual.',
    annotations: { title: 'Marcar chat como leído', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        conversation_id: { type: 'string', description: 'UUID de la conversación.' },
      },
      required: ['conversation_id'],
    },
  },

  // Notificaciones (utilidades adicionales sobre /api/shared/notifications)
  {
    name: 'connect_notifications_unread_count',
    description: 'Devuelve la cantidad de notificaciones sin leer del usuario actual en Connect.',
    annotations: { title: 'Notificaciones sin leer', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
  {
    name: 'connect_notifications_mark_all_read',
    description: 'Marca todas las notificaciones del usuario actual como leídas. Idempotente.',
    annotations: { title: 'Marcar todo como leído', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Turnos

export async function handleConsumerAppointmentsBook(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body = {
    patient_user_id: client.resolveUserId(auth.userId),
    specialist_id: args.specialist_id || undefined,
    business_id: args.business_id || undefined,
    // El backend usa `service` (nombre del servicio), no `service_id`.
    service: args.service_id || args.service || undefined,
    scheduled_start: args.scheduled_start,
    scheduled_end: args.scheduled_end || undefined,
    notes: args.notes || undefined,
    patient_name: args.patient_name || undefined,
    patient_phone: args.patient_phone || undefined,
    patient_email: args.patient_email || undefined,
  };
  const result = await client.post<unknown>('/api/shared/appointments', body, { userId: auth.userId });
  const data = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Turno reservado\n\n` +
        `- **ID:** \`${data?.id || (result as any)?.id || '—'}\`\n` +
        `- **Inicio:** ${args.scheduled_start}\n` +
        `- **Estado:** ${data?.status || 'booked'}`,
    }],
  };
}

export async function handleConsumerAppointmentsListMine(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const userId = client.resolveUserId(auth.userId);
  const params: Record<string, string | number | undefined> = {
    patient_user_id: userId,
    from: args.from ? String(args.from) : undefined,
    to: args.to ? String(args.to) : undefined,
    status: args.status ? String(args.status) : undefined,
  };
  const result = await client.get<unknown>('/api/shared/appointments/mine', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) {
    return { content: [{ type: 'text', text: 'No hay turnos que coincidan con los filtros.' }] };
  }
  const rows = items.map((a) =>
    `- **${a.scheduled_start}** | ${a.specialist_name || a.business_name || '—'} | ${a.service_name || '—'} | _${a.status}_ | \`${a.id}\``,
  );
  return { content: [{ type: 'text', text: `## Mis turnos (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleConsumerAppointmentsCancel(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(`/api/shared/appointments/${encodeURIComponent(id)}/cancel`, {
    patient_user_id: client.resolveUserId(auth.userId),
    cancellation_reason: args.reason || undefined,
  }, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Turno cancelado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleAvailabilityGetSlots(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<unknown>('/api/shared/availability/slots', {
    params: {
      specialist_id: String(args.specialist_id),
      date: String(args.date),
      duration_min: Number(args.duration_min || 30),
    },
    userId: auth.userId,
  });
  const slots = unwrapConnectArray<Record<string, unknown>>(result);
  if (!slots.length) {
    return { content: [{ type: 'text', text: 'No hay slots disponibles en esa fecha.' }] };
  }
  const rows = slots.map((s) => {
    const available = s.available === false ? 'ocupado' : 'libre';
    return `- ${s.start_at} → ${s.end_at} (${available})`;
  });
  return { content: [{ type: 'text', text: `## Slots ${args.date}\n\n${rows.join('\n')}` }] };
}

// Restaurantes

export async function handleRestaurantsSearch(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | number | undefined> = {
    q: args.q ? String(args.q) : undefined,
    lat: args.lat ? Number(args.lat) : undefined,
    lng: args.lng ? Number(args.lng) : undefined,
    radius_km: args.radius_km ? Number(args.radius_km) : undefined,
    limit: args.limit ? Number(args.limit) : 20,
  };
  const result = await client.get<unknown>('/api/connect/restaurants', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No se encontraron restaurantes.' }] };
  const rows = items.map((r) =>
    `- **${r.name}** (${r.slug}) | ${r.city || '—'} | ${r.cuisine || '—'}${r.rating ? ` | ⭐ ${r.rating}` : ''}`,
  );
  return { content: [{ type: 'text', text: `## Restaurantes (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleRestaurantsGetMenu(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const slug = String(args.slug);
  const result = await client.get<any>(`/api/connect/restaurants/${encodeURIComponent(slug)}/menu`, {
    userId: auth.userId,
  });
  const categories: any[] = result?.categories ?? result?.data?.categories ?? (Array.isArray(result) ? result : []);
  if (!categories.length) return { content: [{ type: 'text', text: 'El menú no tiene categorías.' }] };
  const sections = categories.map((c) => {
    const items = (c.items || []).map((it: any) =>
      `  - ${it.name} — $${it.price}${it.is_available === false ? ' (no disponible)' : ''} \`${it.id}\``,
    );
    return `### ${c.name}\n${items.join('\n')}`;
  });
  return { content: [{ type: 'text', text: `## Menú de ${slug}\n\n${sections.join('\n\n')}` }] };
}

export async function handleRestaurantsCreateOrder(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const slug = String(args.slug);
  const body = {
    items: args.items,
    table_id: args.table_id || undefined,
    type: args.type || undefined,
    notes: args.notes || undefined,
    customer_name: args.customer_name || undefined,
    customer_phone: args.customer_phone || undefined,
  };
  const result = await client.post<any>(
    `/api/connect/restaurants/${encodeURIComponent(slug)}/orders`,
    body,
    { userId: auth.userId },
  );
  const token = result?.token || result?.data?.token || '—';
  const orderId = result?.order?.id || result?.data?.order?.id || result?.id || '—';
  return {
    content: [{
      type: 'text',
      text:
        `## Orden creada\n\n` +
        `- **Order ID:** \`${orderId}\`\n` +
        `- **Token público:** \`${token}\`\n` +
        `- **Total:** ${result?.order?.total ?? result?.data?.order?.total ?? '—'}`,
    }],
  };
}

export async function handleOrdersGetStatus(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const token = String(args.token);
  const result = await client.get<any>(`/api/connect/orders/${encodeURIComponent(token)}`, {
    userId: auth.userId,
  });
  const order = result?.order ?? result?.data ?? result;
  return {
    content: [{
      type: 'text',
      text:
        `## Estado de la orden\n\n` +
        `- **Token:** \`${token}\`\n` +
        `- **Estado:** ${order?.status || '—'}\n` +
        `- **Restaurante:** ${order?.restaurant_name || '—'}\n` +
        `- **Total:** ${order?.total ?? '—'}`,
    }],
  };
}

// Especialistas y negocios

export async function handleSpecialistsSearch(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | number | undefined> = {
    specialty: args.specialty ? String(args.specialty) : undefined,
    q: args.q ? String(args.q) : undefined,
    lat: args.lat ? Number(args.lat) : undefined,
    lng: args.lng ? Number(args.lng) : undefined,
    radius_km: args.radius_km ? Number(args.radius_km) : undefined,
    limit: args.limit ? Number(args.limit) : 20,
  };
  const result = await client.get<unknown>('/api/shared/specialists', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No se encontraron especialistas.' }] };
  const rows = items.map((s) =>
    `- **${s.name}** | ${s.specialty || '—'} | ${s.city || '—'}${s.rating ? ` | ⭐ ${s.rating}` : ''} \`${s.id}\``,
  );
  return { content: [{ type: 'text', text: `## Especialistas (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleBusinessesSearch(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | number | undefined> = {
    q: args.q ? String(args.q) : undefined,
    category: args.category ? String(args.category) : undefined,
    business_type: args.business_type ? String(args.business_type) : undefined,
    lat: args.lat !== undefined ? Number(args.lat) : undefined,
    lng: args.lng !== undefined ? Number(args.lng) : undefined,
    radius_km: args.radius_km !== undefined ? Number(args.radius_km) : undefined,
    limit: args.limit !== undefined ? Number(args.limit) : 20,
    offset: args.offset !== undefined ? Number(args.offset) : undefined,
  };
  const result = await client.get<any>('/api/shared/merchants/search', { params, userId: auth.userId });
  const payload = result?.data ?? result;
  const items: Record<string, unknown>[] = Array.isArray(payload?.results) ? payload.results : [];
  const total = typeof payload?.total === 'number' ? payload.total : items.length;
  if (!items.length) return { content: [{ type: 'text', text: 'No se encontraron negocios.' }] };
  const rows = items.map((b) => {
    const distance = b.distance_km !== undefined && b.distance_km !== null
      ? ` | ${Number(b.distance_km).toFixed(1)} km`
      : '';
    const rating = b.rating ? ` | ⭐ ${b.rating}` : '';
    return `- **${b.name}** (${b.slug || '—'}) | ${b.business_type || '—'} | ${b.category || '—'}${distance}${rating} \`${b.id}\``;
  });
  const header = total > items.length ? `## Negocios (${items.length} de ${total})` : `## Negocios (${items.length})`;
  return { content: [{ type: 'text', text: `${header}\n\n${rows.join('\n')}` }] };
}

// Pagos

export async function handlePaymentsCreateAppointmentCharge(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.appointment_id);
  const result = await client.post<any>(
    `/api/shared/appointments/${encodeURIComponent(id)}/regenerate-payment-link`,
    {},
    { userId: auth.userId },
  );
  const data = unwrapConnect<Record<string, unknown>>(result);
  const payload = data ?? result ?? {};
  return {
    content: [{
      type: 'text',
      text:
        `## Checkout generado\n\n` +
        `- **URL de pago:** ${payload.init_point || payload.pay_url || '—'}\n` +
        `- **Monto:** ${payload.amount ?? '—'}\n` +
        `- **Referencia externa:** ${payload.external_reference || '—'}`,
    }],
  };
}

export async function handlePaymentsCreateOrderCharge(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const slug = String(args.restaurant_slug);
  const body = {
    customer_name: args.customer_name,
    customer_email: args.customer_email || undefined,
    lines: args.lines,
    table_token: args.table_token || undefined,
  };
  const result = await client.post<any>(
    `/api/connect/restaurants/${encodeURIComponent(slug)}/orders/checkout`,
    body,
    { userId: auth.userId },
  );
  const data = unwrapConnect<Record<string, unknown>>(result);
  const payload = data ?? result ?? {};
  const offline = !payload.mp_preference_url;
  return {
    content: [{
      type: 'text',
      text: offline
        ? `## Orden creada — pago presencial\n\n` +
          `- **Token de la orden:** ${payload.order_public_token || '—'}\n` +
          `- **Total:** ${payload.total ?? '—'}\n` +
          `- El restaurante no tiene Mercado Pago conectado; el cliente paga en el lugar.`
        : `## Orden creada con checkout\n\n` +
          `- **Token de la orden:** ${payload.order_public_token || '—'}\n` +
          `- **URL de pago:** ${payload.mp_preference_url || '—'}\n` +
          `- **Total:** ${payload.total ?? '—'}`,
    }],
  };
}

export async function handlePaymentsGetStatus(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.charge_id);
  const result = await client.get<any>(`/api/payments/charge/${encodeURIComponent(id)}`, { userId: auth.userId });
  const data = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Estado del cobro\n\n` +
        `- **ID:** \`${id}\`\n` +
        `- **Estado:** ${data?.status || result?.status || '—'}\n` +
        `- **Monto:** ${data?.amount ?? result?.amount ?? '—'}`,
    }],
  };
}

export async function handlePaymentsRegenerateAppointmentLink(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.appointment_id);
  const result = await client.post<any>(
    `/api/shared/appointments/${encodeURIComponent(id)}/regenerate-payment-link`,
    {},
    { userId: auth.userId },
  );
  const data = unwrapConnect<Record<string, unknown>>(result);
  const payload = data ?? result ?? {};
  return {
    content: [{
      type: 'text',
      text:
        `## Nuevo link de pago\n\n` +
        `- **URL:** ${payload.init_point || payload.pay_url || '—'}\n` +
        `- **Monto:** ${payload.amount ?? '—'}`,
    }],
  };
}

// Chats

export async function handleChatsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<unknown>('/api/shared/chats/conversations', { userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay conversaciones.' }] };
  const rows = items.map((c) => {
    const other = (c.other_participant as any)?.name || '—';
    const preview = c.last_message_preview ? String(c.last_message_preview).slice(0, 60) : '';
    return `- **${other}** | ${c.last_message_at || '—'} | ${preview} \`${c.id}\``;
  });
  return { content: [{ type: 'text', text: `## Conversaciones (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleChatsListMessages(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.conversation_id);
  const params: Record<string, string | undefined> = {};
  if (args.since) params.since = String(args.since);
  const result = await client.get<unknown>(
    `/api/shared/chats/conversations/${encodeURIComponent(id)}/messages`,
    { params, userId: auth.userId },
  );
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay mensajes nuevos.' }] };
  const rows = items.map((m) => `- _${m.created_at}_ **${(m.sender_info as any)?.name || m.sender_id}**: ${m.message}`);
  return { content: [{ type: 'text', text: `## Mensajes (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleChatsSendMessage(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.conversation_id);
  const result = await client.post<any>(
    `/api/shared/chats/conversations/${encodeURIComponent(id)}/messages`,
    { message: String(args.text) },
    { userId: auth.userId },
  );
  const msg = result?.message ?? result?.data ?? result;
  return {
    content: [{
      type: 'text',
      text: `## Mensaje enviado\n\n- **ID:** \`${msg?.id || '—'}\``,
    }],
  };
}

export async function handleChatsCreateWithBusiness(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.post<any>(
    '/api/shared/chats/conversations',
    {
      business_id: args.business_id,
      initial_message: args.initial_message || undefined,
    },
    { userId: auth.userId },
  );
  const conv = result?.conversation ?? result?.data ?? result;
  return {
    content: [{
      type: 'text',
      text: `## Conversación abierta\n\n- **ID:** \`${conv?.id || '—'}\``,
    }],
  };
}

export async function handleChatsGetConversation(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.conversation_id);
  const result = await client.get<any>(
    `/api/shared/chats/conversations/${encodeURIComponent(id)}`,
    { userId: auth.userId },
  );
  const conv = result?.conversation ?? result?.data ?? result;
  const other = (conv?.other_participant as any)?.name || '—';
  return {
    content: [{
      type: 'text',
      text:
        `## Conversación\n\n` +
        `- **ID:** \`${conv?.id || id}\`\n` +
        `- **Con:** ${other}\n` +
        `- **Último mensaje:** ${conv?.last_message_at || '—'}\n` +
        `- **No leídos:** ${conv?.unread_count ?? 0}`,
    }],
  };
}

export async function handleChatsMarkRead(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.conversation_id);
  await client.post<unknown>(
    `/api/shared/chats/conversations/${encodeURIComponent(id)}/read`,
    {},
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Conversación marcada como leída\n\n- **ID:** \`${id}\`` }] };
}

// Restaurantes — detalle público

export async function handleRestaurantsGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const slug = String(args.slug);
  const result = await client.get<any>(
    `/api/connect/restaurants/${encodeURIComponent(slug)}`,
    { userId: auth.userId },
  );
  const r = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Restaurante\n\n` +
        `- **Nombre:** ${r?.name || '—'}\n` +
        `- **Slug:** \`${r?.slug || slug}\`\n` +
        `- **Ciudad:** ${r?.city || '—'}\n` +
        `- **Tipo de cocina:** ${r?.cuisine || '—'}\n` +
        `- **Teléfono:** ${r?.phone || '—'}\n` +
        `- **Dirección:** ${r?.address || '—'}`,
    }],
  };
}

// Especialistas — detalle, reseñas

export async function handleSpecialistsGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<any>(
    `/api/shared/specialist-profiles/${encodeURIComponent(id)}`,
    { userId: auth.userId },
  );
  const s = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Especialista\n\n` +
        `- **ID:** \`${s?.id || id}\`\n` +
        `- **Nombre:** ${s?.display_name || s?.name || '—'}\n` +
        `- **Título:** ${s?.title || '—'}\n` +
        `- **Especialidad:** ${s?.specialty || '—'}\n` +
        `- **Ciudad:** ${s?.city || '—'}\n` +
        `- **Consulta:** $${s?.consultation_fee ?? '—'}\n` +
        `- **Rating:** ${s?.rating_avg ?? s?.rating ?? '—'}`,
    }],
  };
}

export async function handleSpecialistsListReviews(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.specialist_id);
  const result = await client.get<unknown>(
    `/api/shared/specialist-profiles/${encodeURIComponent(id)}/reviews`,
    { userId: auth.userId },
  );
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay reseñas todavía.' }] };
  const rows = items.map((r) => {
    const comment = r.comment ? String(r.comment).slice(0, 100) : '';
    return `- **${r.author_name}** | ${r.rating_overall}/5 | ${r.created_at} — ${comment}`;
  });
  return { content: [{ type: 'text', text: `## Reseñas (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSpecialistsCreateReview(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.specialist_id);
  const body: Record<string, unknown> = {
    author_name: args.author_name,
    author_user_id: client.resolveUserId(auth.userId),
    rating_overall: args.rating_overall,
    rating_trato: args.rating_trato,
    rating_puntualidad: args.rating_puntualidad,
    rating_diagnostico: args.rating_diagnostico,
    rating_explicacion: args.rating_explicacion,
    comment: args.comment,
  };
  const result = await client.post<any>(
    `/api/shared/specialist-profiles/${encodeURIComponent(id)}/reviews`,
    body,
    { userId: auth.userId },
  );
  const r = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Reseña creada\n\n` +
        `- **ID:** \`${r?.id || result?.id || '—'}\`\n` +
        `- **Rating:** ${args.rating_overall}/5`,
    }],
  };
}

// Negocios — detalle

export async function handleBusinessesGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = args.id ? String(args.id) : undefined;
  const slug = args.slug ? String(args.slug) : undefined;
  if (!id && !slug) {
    return { content: [{ type: 'text', text: 'Pasá `id` o `slug` para buscar el negocio.' }], isError: true };
  }
  let b: any;
  if (id) {
    const result = await client.get<any>(
      `/api/shared/businesses/${encodeURIComponent(id)}`,
      { userId: auth.userId },
    );
    b = result?.data ?? result;
  } else {
    const result = await client.get<any>(
      `/api/shared/merchants/${encodeURIComponent(slug!)}`,
      { userId: auth.userId },
    );
    b = result?.merchant ?? result?.data ?? result;
  }
  return {
    content: [{
      type: 'text',
      text:
        `## Negocio\n\n` +
        `- **ID:** \`${b?.id || id || '—'}\`\n` +
        `- **Nombre:** ${b?.name || b?.business_name || '—'}\n` +
        `- **Slug:** \`${b?.slug || slug || '—'}\`\n` +
        `- **Categoría:** ${b?.category || b?.category_slug || '—'}\n` +
        `- **Ciudad:** ${b?.city || '—'}\n` +
        `- **Teléfono:** ${b?.phone || '—'}\n` +
        `- **Dirección:** ${b?.address || '—'}`,
    }],
  };
}

// Users — follow / unfollow

export async function handleUsersFollow(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const target = String(args.target_user_id);
  const result = await client.post<any>(
    `/api/shared/users/${encodeURIComponent(target)}/follow`,
    {},
    { userId: auth.userId },
  );
  return {
    content: [{
      type: 'text',
      text:
        `## Empezaste a seguir\n\n` +
        `- **Usuario:** \`${target}\`\n` +
        `- **Seguidores totales:** ${result?.follower_count ?? '—'}`,
    }],
  };
}

export async function handleUsersUnfollow(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const target = String(args.target_user_id);
  const result = await client.post<any>(
    `/api/shared/users/${encodeURIComponent(target)}/unfollow`,
    {},
    { userId: auth.userId },
  );
  return {
    content: [{
      type: 'text',
      text:
        `## Dejaste de seguir\n\n` +
        `- **Usuario:** \`${target}\`\n` +
        `- **Seguidores totales:** ${result?.follower_count ?? '—'}`,
    }],
  };
}

// Notificaciones — utilidades

export async function handleConsumerNotificationsUnreadCount(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/notifications/unread-count', { userId: auth.userId });
  const count = result?.count ?? result?.data?.count ?? result?.unread_count ?? 0;
  return {
    content: [{ type: 'text', text: `## Sin leer\n\n- **Notificaciones:** ${count}` }],
  };
}

export async function handleConsumerNotificationsMarkAllRead(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  await client.post<unknown>('/api/shared/notifications/mark-all-read', {}, { userId: auth.userId });
  return { content: [{ type: 'text', text: '## Todas las notificaciones marcadas como leídas' }] };
}
