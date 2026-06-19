/**
 * Tools de Semilla Connect — modo ESPECIALISTA (profesional de salud / consultor).
 *
 * Operaciones del lado del profesional:
 *   - Listar / confirmar / cancelar / reagendar turnos.
 *   - Gestionar pacientes (alta, búsqueda, detalle).
 *   - Gestionar catálogo de servicios.
 *   - Ver cobros pendientes y KPIs.
 *   - Editar perfil público.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getConnectClient,
  unwrapConnect,
  unwrapConnectArray,
  extractAuthOverrides,
} from '../connect-client.js';
import {
  getClient as getErpClient,
  unwrap as unwrapErp,
  unwrapArray as unwrapErpArray,
  formatCurrency,
  formatDate,
} from '../client.js';

const userIdProp = {
  user_id: { type: 'string', description: 'UUID del especialista. Opcional — se resuelve del JWT si se omite.' },
};

export const connectSpecialistTools: Tool[] = [
  // Turnos
  {
    name: 'connect_specialist_appointments_list',
    description: 'Lista los turnos del especialista, con filtros por fecha y estado.',
    annotations: { title: 'Turnos (especialista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista.' },
        from: { type: 'string', description: 'YYYY-MM-DD.' },
        to: { type: 'string', description: 'YYYY-MM-DD.' },
        status: { type: 'string', description: 'Estado: pending, confirmed, cancelled, completed, no_show.' },
      },
      required: ['specialist_id'],
    },
  },
  {
    name: 'connect_specialist_appointments_confirm',
    description: 'Confirma un turno reservado por un paciente.',
    annotations: { title: 'Confirmar turno', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del turno.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialist_appointments_cancel',
    description: 'Cancela un turno desde el lado del especialista.',
    annotations: { title: 'Cancelar turno', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del turno.' },
        reason: { type: 'string', description: 'Motivo.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialist_appointments_reschedule',
    description: 'Reagenda un turno a una nueva fecha y hora.',
    annotations: { title: 'Reagendar turno', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del turno.' },
        scheduled_start: { type: 'string', description: 'Nueva fecha/hora ISO.' },
        scheduled_end: { type: 'string' },
        duration_minutes: { type: 'number' },
      },
      required: ['id', 'scheduled_start'],
    },
  },

  // Pacientes
  {
    name: 'connect_specialist_patients_list',
    description: 'Lista pacientes del especialista, opcionalmente filtrados por texto.',
    annotations: { title: 'Pacientes (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        q: { type: 'string', description: 'Búsqueda libre (nombre, email).' },
        limit: { type: 'number', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'connect_specialist_patients_create',
    description: 'Crea un paciente en el listado del especialista.',
    annotations: { title: 'Crear paciente', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        dni: { type: 'string' },
        birth_date: { type: 'string', description: 'YYYY-MM-DD.' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'connect_specialist_patients_get',
    description: 'Devuelve el detalle de un paciente por id.',
    annotations: { title: 'Detalle de paciente', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del paciente.' } },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialist_patients_update',
    description: 'Actualiza los datos de un paciente del especialista.',
    annotations: { title: 'Actualizar paciente', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del paciente.' },
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        dni: { type: 'string' },
        birth_date: { type: 'string', description: 'YYYY-MM-DD.' },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialist_patients_delete',
    description: 'Elimina un paciente del listado del especialista (soft delete).',
    annotations: { title: 'Eliminar paciente', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del paciente.' } },
      required: ['id'],
    },
  },

  // Servicios — viven en el ERP (módulo health/scheduling como AppointmentServiceType).
  // El catálogo es por tenant; el JWT del ERP resuelve tenant_id automáticamente.
  {
    name: 'connect_specialist_services_list',
    description: 'Lista los servicios (tipos de cita) configurados en el tenant del especialista.',
    annotations: { title: 'Servicios (lista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
  {
    name: 'connect_specialist_services_create',
    description: 'Crea un servicio (tipo de cita) en el catálogo del tenant.',
    annotations: { title: 'Crear servicio', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        name: { type: 'string', description: 'Nombre del servicio.' },
        duration_minutes: { type: 'number', description: 'Duración del turno en minutos (default 30).' },
        buffer_minutes: { type: 'number', description: 'Buffer entre turnos en minutos (default 0).' },
        color: { type: 'string', description: 'Color hex para mostrar en la agenda (default #059669).' },
        is_active: { type: 'boolean', default: true },
      },
      required: ['name'],
    },
  },
  {
    name: 'connect_specialist_services_update',
    description: 'Actualiza un servicio existente del catálogo.',
    annotations: { title: 'Actualizar servicio', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        id: { type: 'string', description: 'UUID del servicio.' },
        name: { type: 'string' },
        duration_minutes: { type: 'number' },
        buffer_minutes: { type: 'number' },
        color: { type: 'string' },
        is_active: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'connect_specialist_services_delete',
    description: 'Elimina un servicio del catálogo.',
    annotations: { title: 'Eliminar servicio', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp, id: { type: 'string', description: 'UUID del servicio.' } },
      required: ['id'],
    },
  },

  // Cobros (ingresos del tenant). Se listan los AccountPayment del ERP de tipo
  // `inbound` (cobros de cliente). El JWT del ERP resuelve el tenant; no hay
  // filtro nativo por specialist_id en pagos contables.
  {
    name: 'connect_specialist_earnings_list',
    description:
      'Lista los cobros (AccountPayment inbound) del tenant en un período. Sin filtro nativo por especialista — devuelve los cobros del tenant entero.',
    annotations: { title: 'Cobros (especialista)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        from: { type: 'string', description: 'Fecha desde (YYYY-MM-DD).' },
        to: { type: 'string', description: 'Fecha hasta (YYYY-MM-DD).' },
        status: {
          type: 'string',
          description: 'Estado del pago: draft | posted | cancelled. Default posted (cobrado).',
        },
        partner_id: { type: 'string', description: 'UUID del cliente para filtrar (opcional).' },
      },
      required: [],
    },
  },
  {
    name: 'connect_specialist_metrics_overview',
    description: 'KPIs generales del especialista: ingresos, citas, tasa de pago, día más ocupado.',
    annotations: { title: 'KPIs del especialista', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista (no del user).' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['specialist_id'],
    },
  },
  {
    name: 'connect_specialist_metrics_top_services',
    description: 'Ranking de servicios más vendidos del especialista en el período.',
    annotations: { title: 'Top servicios', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['specialist_id'],
    },
  },

  {
    name: 'connect_specialist_metrics_revenue_series',
    description:
      'Devuelve la serie de ingresos del especialista agrupada por día, semana o mes para gráficos.',
    annotations: { title: 'Serie de ingresos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista.' },
        from: { type: 'string', description: 'YYYY-MM-DD.' },
        to: { type: 'string', description: 'YYYY-MM-DD.' },
        group_by: { type: 'string', enum: ['day', 'week', 'month'], default: 'month' },
      },
      required: ['specialist_id'],
    },
  },

  // Pagos — onboarding del profesional (Mercado Pago / Semilla Pay)
  {
    name: 'connect_payments_onboarding_start',
    description:
      'Inicia el flujo de onboarding de pagos del profesional (devuelve la URL para vincular su cuenta de cobro).',
    annotations: { title: 'Iniciar onboarding de pagos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },
  {
    name: 'connect_payments_onboarding_status',
    description:
      'Devuelve el estado actual del onboarding de pagos del profesional (si tiene cuenta vinculada y operativa).',
    annotations: { title: 'Estado de onboarding de pagos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: { ...userIdProp },
      required: [],
    },
  },

  // Perfil
  {
    name: 'connect_specialist_profile_update',
    description: 'Actualiza el perfil público del especialista (bio, especialidad, etc.).',
    annotations: { title: 'Actualizar perfil del especialista', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ...userIdProp,
        specialist_id: { type: 'string', description: 'UUID del perfil de especialista.' },
        display_name: { type: 'string' },
        title: { type: 'string' },
        specialty: { type: 'string' },
        bio: { type: 'string' },
        phone: { type: 'string' },
        city: { type: 'string' },
        address: { type: 'string' },
        consultation_fee: { type: 'number' },
        is_public: { type: 'boolean' },
      },
      required: ['specialist_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

// Turnos

export async function handleSpecialistAppointmentsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  // /api/shared/appointments/mine es para el consumidor (filtra por patient_user_id).
  // El especialista usa GET /api/shared/appointments con specialist_id.
  const specialistId = args.specialist_id ? String(args.specialist_id) : undefined;
  if (!specialistId) {
    return {
      content: [{ type: 'text', text: 'Falta `specialist_id` para listar turnos del especialista.' }],
      isError: true,
    };
  }
  const params: Record<string, string | number | undefined> = {
    specialist_id: specialistId,
    from: args.from ? String(args.from) : undefined,
    to: args.to ? String(args.to) : undefined,
    status: args.status ? String(args.status) : undefined,
  };
  const result = await client.get<unknown>('/api/shared/appointments', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay turnos.' }] };
  const rows = items.map((a) =>
    `- **${a.start_at || a.scheduled_start}** | ${a.patient_name || '—'} | ${a.service_name || a.service || '—'} | _${a.status}_ \`${a.id}\``,
  );
  return { content: [{ type: 'text', text: `## Turnos (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSpecialistAppointmentsConfirm(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  // El backend no expone /confirm; se confirma cambiando el status vía PATCH /:id/status.
  await client.patch<unknown>(
    `/api/shared/appointments/${encodeURIComponent(id)}/status`,
    { status: 'confirmed' },
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Turno confirmado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleSpecialistAppointmentsCancel(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  // POST /:id/cancel es solo para cancelación por el paciente (requiere patient_user_id).
  // El especialista cancela vía PATCH /:id/status con status=cancelled + cancellation_reason.
  await client.patch<unknown>(
    `/api/shared/appointments/${encodeURIComponent(id)}/status`,
    { status: 'cancelled', cancellation_reason: args.reason || undefined, marked_by: 'specialist' },
    { userId: auth.userId },
  );
  return { content: [{ type: 'text', text: `## Turno cancelado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleSpecialistAppointmentsReschedule(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  // El backend expone reschedule como PATCH, no POST.
  await client.patch<unknown>(
    `/api/shared/appointments/${encodeURIComponent(id)}/reschedule`,
    {
      scheduled_start: args.scheduled_start,
      scheduled_end: args.scheduled_end || undefined,
      duration_minutes: args.duration_minutes || undefined,
    },
    { userId: auth.userId },
  );
  return {
    content: [{
      type: 'text',
      text: `## Turno reagendado\n\n- **ID:** \`${id}\`\n- **Nueva fecha:** ${args.scheduled_start}`,
    }],
  };
}

// Pacientes

export async function handleSpecialistPatientsList(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const params: Record<string, string | number | undefined> = {
    q: args.q ? String(args.q) : undefined,
    limit: args.limit ? Number(args.limit) : 50,
  };
  const result = await client.get<unknown>('/api/shared/patients', { params, userId: auth.userId });
  const items = unwrapConnectArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay pacientes.' }] };
  const rows = items.map((p) =>
    `- **${p.name}** | ${p.email || '—'} | ${p.phone || '—'} \`${p.id}\``,
  );
  return { content: [{ type: 'text', text: `## Pacientes (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSpecialistPatientsCreate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const body = {
    name: args.name,
    email: args.email || undefined,
    phone: args.phone || undefined,
    dni: args.dni || undefined,
    birth_date: args.birth_date || undefined,
    notes: args.notes || undefined,
  };
  const result = await client.post<any>('/api/shared/patients', body, { userId: auth.userId });
  const data = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Paciente creado\n\n- **ID:** \`${data?.id || result?.id || '—'}\`\n- **Nombre:** ${args.name}`,
    }],
  };
}

export async function handleSpecialistPatientsGet(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const result = await client.get<any>(`/api/shared/patients/${encodeURIComponent(id)}`, { userId: auth.userId });
  const p = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Paciente\n\n` +
        `- **ID:** \`${p?.id}\`\n` +
        `- **Nombre:** ${p?.name}\n` +
        `- **Email:** ${p?.email || '—'}\n` +
        `- **Teléfono:** ${p?.phone || '—'}\n` +
        `- **DNI:** ${p?.dni || '—'}\n` +
        `- **Nacimiento:** ${p?.birth_date || '—'}`,
    }],
  };
}

export async function handleSpecialistPatientsUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of ['name', 'email', 'phone', 'dni', 'birth_date', 'notes']) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<any>(`/api/shared/patients/${encodeURIComponent(id)}`, body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Paciente actualizado\n\n- **ID:** \`${id}\`` }] };
}

export async function handleSpecialistPatientsDelete(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.id);
  await client.del<unknown>(`/api/shared/patients/${encodeURIComponent(id)}`, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Paciente eliminado\n\n- **ID:** \`${id}\`` }] };
}

// Servicios — viven en el ERP como AppointmentServiceType (módulo health/scheduling).
// Endpoints: /api/semilla/health/scheduling/service-types. Usa cliente ERP (Bearer JWT).
// El tenant_id se resuelve del JWT por el middleware tenantSearchPath del ERP.

export async function handleSpecialistServicesList(_args: Record<string, unknown>) {
  const client = getErpClient();
  const result = await client.get<unknown>('/api/semilla/health/scheduling/service-types');
  const items = unwrapErpArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay servicios configurados.' }] };
  const rows = items.map((s) => {
    const dur = s.duration_minutes ?? '—';
    const buf = s.buffer_minutes ?? 0;
    const active = s.is_active === false ? ' _(inactivo)_' : '';
    return `- **${s.name}** | ${dur} min | buffer ${buf} min${active} \`${s.id}\``;
  });
  return { content: [{ type: 'text', text: `## Servicios (${items.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSpecialistServicesCreate(args: Record<string, unknown>) {
  const client = getErpClient();
  const body: Record<string, unknown> = { name: args.name };
  if (args.duration_minutes !== undefined) body.duration_minutes = Number(args.duration_minutes);
  if (args.buffer_minutes !== undefined) body.buffer_minutes = Number(args.buffer_minutes);
  if (args.color !== undefined) body.color = String(args.color);
  if (args.is_active !== undefined) body.is_active = Boolean(args.is_active);
  const result = await client.post<unknown>('/api/semilla/health/scheduling/service-types', body);
  const created = unwrapErp<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Servicio creado\n\n` +
        `- **ID:** \`${created?.id ?? '—'}\`\n` +
        `- **Nombre:** ${created?.name ?? args.name}\n` +
        `- **Duración:** ${created?.duration_minutes ?? args.duration_minutes ?? 30} min`,
    }],
  };
}

export async function handleSpecialistServicesUpdate(args: Record<string, unknown>) {
  const client = getErpClient();
  const id = String(args.id);
  const body: Record<string, unknown> = {};
  for (const k of ['name', 'duration_minutes', 'buffer_minutes', 'color', 'is_active']) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  const result = await client.patch<unknown>(
    `/api/semilla/health/scheduling/service-types/${encodeURIComponent(id)}`,
    body,
  );
  const updated = unwrapErp<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Servicio actualizado\n\n- **ID:** \`${id}\`\n- **Nombre:** ${updated?.name ?? '—'}`,
    }],
  };
}

export async function handleSpecialistServicesDelete(args: Record<string, unknown>) {
  const client = getErpClient();
  const id = String(args.id);
  await client.request<unknown>(
    `/api/semilla/health/scheduling/service-types/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  return { content: [{ type: 'text', text: `## Servicio eliminado\n\n- **ID:** \`${id}\`` }] };
}

// Cobros — listado de AccountPayment inbound del tenant.
// Endpoint: GET /api/semilla/accounting/payments. No hay filtro nativo por specialist.

export async function handleSpecialistEarningsList(args: Record<string, unknown>) {
  const client = getErpClient();
  const params: Record<string, string | number | undefined> = {
    payment_type: 'inbound',
    partner_type: 'customer',
    state: args.status ? String(args.status) : 'posted',
    date_from: args.from ? String(args.from) : undefined,
    date_to: args.to ? String(args.to) : undefined,
    partner_id: args.partner_id ? String(args.partner_id) : undefined,
  };
  const result = await client.get<unknown>('/api/semilla/accounting/payments', params);
  const items = unwrapErpArray<Record<string, unknown>>(result);
  if (!items.length) return { content: [{ type: 'text', text: 'No hay cobros en el período.' }] };
  const rows = items.map((p) => {
    const date = p.payment_date ? formatDate(String(p.payment_date)) : '—';
    const amount = formatCurrency(Number(p.amount || 0));
    const state = p.state || '—';
    return `- **${date}** | ${amount} | _${state}_ \`${p.id}\``;
  });
  const total = items.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    content: [{
      type: 'text',
      text:
        `## Cobros (${items.length})\n\n` +
        `- **Total:** ${formatCurrency(total)}\n\n` +
        rows.join('\n'),
    }],
  };
}

export async function handleSpecialistMetricsOverview(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/metrics/overview', {
    params: {
      specialist_id: String(args.specialist_id),
      from: args.from ? String(args.from) : undefined,
      to: args.to ? String(args.to) : undefined,
    },
    userId: auth.userId,
  });
  const m: any = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Métricas\n\n` +
        `- **Ingresos totales:** $${m?.revenue?.total ?? '—'}\n` +
        `- **Promedio por cita:** $${m?.revenue?.avg_per_appointment ?? '—'}\n` +
        `- **Citas totales:** ${m?.appointments?.total ?? '—'}\n` +
        `- **Completadas:** ${m?.appointments?.completed ?? '—'} | **Canceladas:** ${m?.appointments?.cancelled ?? '—'}\n` +
        `- **Tasa de pago:** ${m?.payment_rate?.paid_percent ?? '—'}%\n` +
        `- **Día más ocupado:** ${m?.busiest_day?.day_name ?? '—'}`,
    }],
  };
}

export async function handleSpecialistMetricsTopServices(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/metrics/top-services', {
    params: {
      specialist_id: String(args.specialist_id),
      from: args.from ? String(args.from) : undefined,
      to: args.to ? String(args.to) : undefined,
    },
    userId: auth.userId,
  });
  const services: any[] = result?.services ?? result?.data?.services ?? [];
  if (!services.length) return { content: [{ type: 'text', text: 'No hay datos de servicios.' }] };
  const rows = services.map((s) =>
    `- **${s.service}** | ${s.count} citas | $${s.revenue} | promedio $${s.avg_price}`,
  );
  return { content: [{ type: 'text', text: `## Top servicios\n\n${rows.join('\n')}` }] };
}

export async function handleSpecialistMetricsRevenueSeries(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/shared/metrics/revenue', {
    params: {
      specialist_id: String(args.specialist_id),
      from: args.from ? String(args.from) : undefined,
      to: args.to ? String(args.to) : undefined,
      group_by: args.group_by ? String(args.group_by) : 'month',
    },
    userId: auth.userId,
  });
  const series: any[] = result?.series ?? result?.data?.series ?? [];
  if (!series.length) return { content: [{ type: 'text', text: 'No hay datos de ingresos para el período.' }] };
  const rows = series.map((s) =>
    `- **${s.period}** | ${s.count} citas | $${s.total} | promedio $${s.avg}`,
  );
  return { content: [{ type: 'text', text: `## Serie de ingresos\n\n${rows.join('\n')}` }] };
}

// Pagos — onboarding

export async function handlePaymentsOnboardingStart(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/payments/onboarding/start', { userId: auth.userId });
  const data: any = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Onboarding de pagos\n\n` +
        `- **URL para vincular cuenta:** ${data?.url || data?.onboarding_url || result?.url || '—'}`,
    }],
  };
}

export async function handlePaymentsOnboardingStatus(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const result = await client.get<any>('/api/payments/onboarding/status', { userId: auth.userId });
  const data: any = unwrapConnect<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Estado de onboarding\n\n` +
        `- **Cuenta vinculada:** ${data?.connected ? 'sí' : 'no'}\n` +
        `- **Estado:** ${data?.status || '—'}\n` +
        `- **Provider:** ${data?.provider || '—'}`,
    }],
  };
}

// Perfil

export async function handleSpecialistProfileUpdate(args: Record<string, unknown>) {
  const client = getConnectClient();
  const auth = extractAuthOverrides(args);
  const id = String(args.specialist_id);
  const body: Record<string, unknown> = {};
  for (const k of [
    'display_name', 'title', 'specialty', 'bio', 'phone', 'city', 'address',
    'consultation_fee', 'is_public',
  ]) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  await client.put<unknown>(`/api/shared/specialist-profiles/${encodeURIComponent(id)}`, body, { userId: auth.userId });
  return { content: [{ type: 'text', text: `## Perfil actualizado\n\n- **ID:** \`${id}\`` }] };
}
