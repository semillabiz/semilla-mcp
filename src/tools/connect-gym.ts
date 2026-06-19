/**
 * Tools de Semilla Connect — modo GYM (gimnasio).
 *
 * Operaciones:
 *   - Miembros: listar, crear, ver, hacer checkout (cobrar plan), enviar invitación.
 *   - Planes: listar, crear, actualizar, eliminar.
 *   - Accesos: check-in (al escanear QR o por id).
 *   - Settings: ver y actualizar.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectClient,
  unwrapConnect,
  unwrapConnectArray,
  extractAuthOverrides,
} from '../connect-client.js';

const userIdProp = {
  user_id: { type: 'string', description: 'UUID del usuario gym admin. Opcional — se resuelve del JWT si se omite.' },
};

const merchantIdProp = {
  merchant_id: { type: 'string', description: 'UUID del merchant_profile del gimnasio (requerido por el backend).' },
};

export const connectGymTools: Tool[] = [
  // Miembros
  {
    name: 'connect_gym_members_list',
    description: 'Lista los miembros del gimnasio, opcionalmente filtrados por estado o texto.',
    annotations: { title: 'Miembros (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        q: { type: 'string', description: 'Búsqueda libre (se envía como `search` al backend).' },
        status: { type: 'string', description: 'active | expired | paused' },
      },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_gym_members_create',
    description:
      'Alta de un miembro nuevo en el gimnasio. La foto (photo_url) es OBLIGATORIA en el backend.',
    annotations: { title: 'Crear miembro', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        full_name: { type: 'string', description: 'Nombre completo del miembro.' },
        email: { type: 'string' },
        phone: { type: 'string' },
        birthdate: { type: 'string', description: 'YYYY-MM-DD.' },
        emergency_contact: { type: 'string' },
        medical_notes: { type: 'string' },
        photo_url: { type: 'string', description: 'URL de la foto del miembro (requerida).' },
      },
      required: ['merchant_id', 'full_name', 'photo_url'],
    },
  },
  {
    name: 'connect_gym_members_get',
    description: 'Devuelve el detalle de un miembro.',
    annotations: { title: 'Detalle de miembro', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del miembro.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_gym_members_checkout',
    description:
      'Asigna (o renueva) un plan a un miembro. Crea una suscripción activa que reemplaza a la ' +
      'anterior. Devuelve la fecha de expiración (end_date) calculada según duration_days del plan. ' +
      'El cobro del plan se hace por separado mediante POST /members/:id/payments si es necesario.',
    annotations: { title: 'Asignar plan a miembro', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del miembro.' },
        plan_id: { type: 'string', description: 'UUID del plan.' },
        start_date: { type: 'string', description: 'Fecha de inicio YYYY-MM-DD (opcional, default hoy).' },
      },
      required: ['id', 'plan_id'],
    },
  },
  {
    name: 'connect_gym_members_send_invite',
    description: 'Envía al miembro un email o SMS de invitación con QR y credenciales.',
    annotations: { title: 'Enviar invitación a miembro', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del miembro.' } },
      required: ['id'],
    },
  },

  // Planes
  {
    name: 'connect_gym_plans_list',
    description: 'Lista los planes disponibles del gimnasio.',
    annotations: { title: 'Planes (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, ...merchantIdProp },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_gym_plans_create',
    description: 'Crea un plan nuevo (mensual, trimestral, etc.).',
    annotations: { title: 'Crear plan', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        ...merchantIdProp,
        name: { type: 'string' },
        duration_days: { type: 'number', description: 'Duración del plan en días.' },
        price: { type: 'number' },
        description: { type: 'string' },
        currency: { type: 'string', description: 'Default: ARS.' },
        billing_cycle: { type: 'string', description: 'one_time | monthly. Default: one_time.' },
      },
      required: ['merchant_id', 'name', 'duration_days', 'price'],
    },
  },
  {
    name: 'connect_gym_plans_update',
    description: 'Actualiza un plan existente.',
    annotations: { title: 'Actualizar plan', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del plan.' },
        name: { type: 'string' },
        duration_days: { type: 'number' },
        price: { type: 'number' },
        description: { type: 'string' },
        is_active: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_gym_plans_delete',
    description: 'Elimina (o desactiva) un plan.',
    annotations: { title: 'Eliminar plan', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del plan.' } },
      required: ['id'],
    },
  },

  // Accesos
  {
    name: 'connect_gym_access_checkin',
    description:
      'Registra un check-in de un miembro al gimnasio. Acepta member_id directo o payload del QR ' +
      '(que generalmente codifica el member_id).',
    annotations: { title: 'Registrar acceso', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        member_id: { type: 'string', description: 'UUID del miembro.' },
        qr_payload: { type: 'string', description: 'Contenido bruto del QR (alternativa a member_id).' },
      },
      required: [],
    },
  },

  // Settings
  {
    name: 'connect_gym_settings_get',
    description: 'Devuelve los settings del gimnasio (logo, colores, geofence, etc.).',
    annotations: { title: 'Settings del gym', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, merchant_id: { type: 'string', description: 'UUID del merchant del gym.' } },
      required: ['merchant_id'],
    },
  },
  {
    name: 'connect_gym_settings_update',
    description: 'Actualiza los settings del gimnasio.',
    annotations: { title: 'Actualizar settings del gym', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        merchant_id: { type: 'string', description: 'UUID del merchant.' },
        display_name: { type: 'string' },
        logo_url: { type: 'string' },
        primary_color: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        geofence_radius_m: { type: 'number' },
        timezone: { type: 'string' },
        auto_approve_members: { type: 'boolean' },
        show_plan_prices: { type: 'string', description: 'public | members | hidden' },
        show_members_count: { type: 'boolean' },
      },
      required: ['merchant_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Miembros

export async function handleGymMembersList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | undefined> = {
    merchant_id: String(args.merchant_id),
    search: args.q ? String(args.q) : undefined,
    status: args.status ? String(args.status) : undefined,
  };
  const result = await client.get<any>('/api/shared/gym/members', { params, userId: auth.userId });
  const items: Record<string, unknown>[] = Array.isArray(result?.members)
    ? result.members
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay miembros.' }] };
  const rows = items.map((m: any) => {
    const sub = m.active_subscription;
    return `- **${m.full_name}** | ${sub?.plan_name || '—'} | exp: ${sub?.end_date || '—'} | _${m.status || '—'}_ \`${m.id}\``;
  });
  return { content: [{ type: 'text', text: `## Miembros (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleGymMembersCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = {
    merchant_id: args.merchant_id,
    full_name: args.full_name,
    email: args.email,
    phone: args.phone,
    birthdate: args.birthdate,
    emergency_contact: args.emergency_contact,
    medical_notes: args.medical_notes,
    photo_url: args.photo_url,
  };
  const result = await client.post<any>('/api/shared/gym/members', body, { userId: auth.userId });
  const data = result?.member ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Miembro creado\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Nombre:** ${args.full_name}`,
    }],
  };
}

export async function handleGymMembersGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<any>(`/api/shared/gym/members/${encodeURIComponent(id)}`, { userId: auth.userId });
  const m: any = result?.member ?? unwrapConnect<Record<string, unknown>>(result);
  const sub = m?.active_subscription;
  return {
    content: [{
      type: 'text',
      text:
        `## Miembro\n\n` +
        `- **ID:** \`${m?.id}\`\n` +
        `- **Nombre:** ${m?.full_name || m?.name || '—'}\n` +
        `- **Email:** ${m?.email || '—'}\n` +
        `- **Plan:** ${sub?.plan_name || '—'}\n` +
        `- **Vence:** ${sub?.end_date || '—'}\n` +
        `- **Estado:** ${m?.status || '—'}`,
    }],
  };
}

export async function handleGymMembersCheckout(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  // En el backend, POST /members/:id/checkout cierra una sesión de acceso activa
  // (control de salida). Para asignar/cobrar un plan se usa POST /members/:id/subscriptions.
  const result = await client.post<any>(
    `/api/shared/gym/members/${encodeURIComponent(id)}/subscriptions`,
    { plan_id: args.plan_id, start_date: args.start_date },
    { userId: auth.userId },
  );
  const sub = result?.subscription ?? result?.data ?? result;
  return {
    content: [{
      type: 'text',
      text: `## Plan asignado\n\n- **Miembro:** \`${id}\`\n- **Plan:** \`${args.plan_id}\`\n- **Vence:** ${sub?.end_date || '—'}`,
    }],
  };
}

export async function handleGymMembersSendInvite(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.post<unknown>(
    `/api/shared/gym/members/${encodeURIComponent(id)}/send-invite`,
    {},
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Invitación enviada\n\n- **Miembro:** \`${id}\`` }] };
}

// Planes

export async function handleGymPlansList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/gym/plans', {
    params: { merchant_id: String(args.merchant_id) },
    userId: auth.userId,
  });
  const items: Record<string, unknown>[] = Array.isArray(result?.plans)
    ? result.plans
    : unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay planes.' }] };
  const rows = items.map((p) =>
    `- **${p.name}** | ${p.duration_days} días | $${p.price} | _${p.is_active === false ? 'inactivo' : 'activo'}_ \`${p.id}\``,
  );
  return { content: [{ type: 'text', text: `## Planes\n\n${rows.join('\n')}` }] };
}

export async function handleGymPlansCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = {
    merchant_id: args.merchant_id,
    name: args.name,
    duration_days: args.duration_days,
    price: args.price,
    description: args.description,
    currency: args.currency,
    billing_cycle: args.billing_cycle,
  };
  const result = await client.post<any>('/api/shared/gym/plans', body, { userId: auth.userId });
  const data = result?.plan ?? unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Plan creado\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Nombre:** ${args.name}`,
    }],
  };
}

export async function handleGymPlansUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of ['name', 'duration_days', 'price', 'description', 'is_active']) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>(`/api/shared/gym/plans/${encodeURIComponent(id)}`, body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Plan actualizado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleGymPlansDelete(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.del<unknown>(`/api/shared/gym/plans/${encodeURIComponent(id)}`, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Plan eliminado\n\n- **ID:** \`${id}\`` }] };
}

// Accesos

export async function handleGymAccessCheckin(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  let memberId = args.member_id ? String(args.member_id) : '';
  if (!memberId && args.qr_payload) {
    const raw = String(args.qr_payload).trim();
    try {
      const parsed = JSON.parse(raw);
      memberId = parsed.member_id || parsed.id || raw;
    } catch {
      memberId = raw;
    }
  }
  if (!memberId) {
    return {
      content: [{ type: 'text', text: 'Falta `member_id` o `qr_payload` para registrar el check-in.' }],
      isError: true,
    };
  }
  // AUDIT: el backend NO expone POST /api/shared/gym/members/:id/checkin.
  // El flujo real de check-in es vía kiosk session (POST /kiosk/session + GET /kiosk/session/:id/status)
  // o vía manual-access del admin (POST /members/:id/manual-access).
  // Usamos manual-access que es el equivalente más cercano (admin fuerza el ingreso del socio).
  const result = await client.post<any>(
    `/api/shared/gym/members/${encodeURIComponent(memberId)}/manual-access`,
    {},
    { userId: auth.userId },
  );
  return {
    content: [{
      type: 'text',
      text:
        `## Acceso registrado (manual override)\n\n` +
        `- **Miembro:** \`${memberId}\`\n` +
        `- **Resultado:** ${result?.result || result?.message || 'OK'}`,
    }],
  };
}

// Settings

export async function handleGymSettingsGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/gym/settings', {
    params: { merchant_id: String(args.merchant_id) },
    userId: auth.userId,
  });
  const s: any = result?.settings ?? result?.data ?? result;
  return {
    content: [{
      type: 'text',
      text:
        `## Settings del gym\n\n` +
        `- **Display name:** ${s?.display_name || '—'}\n` +
        `- **Color:** ${s?.primary_color || '—'}\n` +
        `- **Timezone:** ${s?.timezone || '—'}\n` +
        `- **Geofence radio:** ${s?.geofence_radius_m ?? '—'} m\n` +
        `- **Auto-aprobar miembros:** ${s?.auto_approve_members ? 'sí' : 'no'}`,
    }],
  };
}

export async function handleGymSettingsUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body: Record<string, unknown> = { merchant_id: args.merchant_id };
  for (const k of [
    'display_name', 'logo_url', 'primary_color', 'latitude', 'longitude',
    'geofence_radius_m', 'timezone', 'auto_approve_members', 'show_plan_prices', 'show_members_count',
  ]) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>('/api/shared/gym/settings', body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Settings actualizados\n\n- **Merchant:** \`${args.merchant_id}\`` }] };
}
