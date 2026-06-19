/**
 * Tools de Salud para Semilla MCP.
 * Endpoints: /api/semilla/health, /api/semilla/scheduling
 *
 * IMPORTANTE — Datos sensibles:
 *  - NO se exponen acciones de firma de receta, escritura de historia clínica,
 *    ni dispensación de medicamentos. Esas acciones críticas se hacen siempre
 *    desde la app web con doble validación humana.
 *  - Lo que sí se expone: lectura de pacientes, agenda, profesionales, recetas.
 *  - Creación de pacientes y citas usa patrón preview/confirm.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap, unwrapArray } from '../client.js';

export const healthTools: Tool[] = [
  {
    name: 'salud_get_dashboard',
    description: 'Resumen del módulo Salud: turnos del día, pacientes nuevos, no-shows, tasa de ocupación.',
    annotations: { title: 'Dashboard de Salud', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'salud_buscar_pacientes',
    description:
      'Busca pacientes por nombre, DNI o email. ' +
      'Devuelve lista resumida (id, nombre, DNI, último turno).',
    annotations: { title: 'Buscar pacientes', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar (nombre, DNI, email)' },
        limit: { type: 'number', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'salud_get_paciente',
    description:
      'Detalle de un paciente: datos personales, obra social, alertas. ' +
      'NO incluye historia clínica completa por privacidad — usar la app para eso.',
    annotations: { title: 'Detalle de paciente', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string', description: 'UUID del paciente' },
      },
      required: ['paciente_id'],
    },
  },
  {
    name: 'salud_preview_crear_paciente',
    description: 'PASO 1: Previsualiza la creación de un paciente. Después usar `salud_confirmar_crear_paciente`.',
    annotations: { title: 'Vista previa: crear paciente', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        apellido: { type: 'string' },
        dni: { type: 'string' },
        fecha_nacimiento: { type: 'string', description: 'YYYY-MM-DD' },
        email: { type: 'string' },
        telefono: { type: 'string' },
        obra_social: { type: 'string' },
        numero_afiliado: { type: 'string' },
      },
      required: ['nombre', 'apellido', 'dni'],
    },
  },
  {
    name: 'salud_confirmar_crear_paciente',
    description: 'PASO 2: Crea efectivamente al paciente.',
    annotations: { title: 'Crear paciente', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        apellido: { type: 'string' },
        dni: { type: 'string' },
        fecha_nacimiento: { type: 'string' },
        email: { type: 'string' },
        telefono: { type: 'string' },
        obra_social: { type: 'string' },
        numero_afiliado: { type: 'string' },
      },
      required: ['nombre', 'apellido', 'dni'],
    },
  },
  {
    name: 'salud_listar_profesionales',
    description: 'Lista los profesionales de la salud configurados (con especialidad).',
    annotations: { title: 'Listar profesionales', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        especialidad: { type: 'string', description: 'Filtrar por especialidad (opcional)' },
        activos: { type: 'boolean', description: 'Solo activos', default: true },
      },
      required: [],
    },
  },
  {
    name: 'salud_get_horarios_profesional',
    description: 'Obtiene los horarios habituales y excepciones de un profesional.',
    annotations: { title: 'Horarios del profesional', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        profesional_id: { type: 'string', description: 'UUID del profesional' },
      },
      required: ['profesional_id'],
    },
  },
  {
    name: 'salud_get_agenda',
    description:
      'Agenda del día: turnos confirmados y pendientes, ordenados por hora. ' +
      'Filtrable por profesional.',
    annotations: { title: 'Agenda del día', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD (default: hoy)' },
        profesional_id: { type: 'string', description: 'Filtrar por profesional (opcional)' },
      },
      required: [],
    },
  },
  {
    name: 'salud_listar_appointments',
    description: 'Lista citas con filtros por estado, profesional y rango.',
    annotations: { title: 'Listar turnos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['todas', 'pendiente', 'confirmada', 'realizada', 'cancelada', 'no_show'],
          default: 'todas',
        },
        profesional_id: { type: 'string', description: 'Filtrar por profesional' },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
        limit: { type: 'number', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'salud_preview_crear_appointment',
    description: 'PASO 1: Previsualiza una cita. Verifica horario disponible. Después usar `salud_confirmar_crear_appointment`.',
    annotations: { title: 'Vista previa: crear turno', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string' },
        profesional_id: { type: 'string' },
        tipo_servicio_id: { type: 'string', description: 'UUID del tipo de servicio (consulta, control, etc.)' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        hora: { type: 'string', description: 'HH:MM' },
        notas: { type: 'string' },
      },
      required: ['paciente_id', 'profesional_id', 'fecha', 'hora'],
    },
  },
  {
    name: 'salud_confirmar_crear_appointment',
    description: 'PASO 2: Crea la cita en el sistema.',
    annotations: { title: 'Crear turno', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string' },
        profesional_id: { type: 'string' },
        tipo_servicio_id: { type: 'string' },
        fecha: { type: 'string' },
        hora: { type: 'string' },
        notas: { type: 'string' },
      },
      required: ['paciente_id', 'profesional_id', 'fecha', 'hora'],
    },
  },
  {
    name: 'salud_listar_recetas',
    description:
      'Lista recetas (solo lectura). Sirve para consultar qué recetas se emitieron a un paciente. ' +
      'NO permite firmar ni dispensar — esas acciones se hacen desde la app web.',
    annotations: { title: 'Listar recetas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string', description: 'Filtrar por paciente (opcional)' },
        profesional_id: { type: 'string', description: 'Filtrar por profesional (opcional)' },
        limit: { type: 'number', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'salud_dental_listar_presupuestos',
    description:
      'Lista presupuestos dentales (planes de tratamiento) con totales y split obra social / paciente. ' +
      'Solo lectura: la presentación, aprobación y ejecución se hacen desde la app web.',
    annotations: { title: 'Listar presupuestos dentales', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string', description: 'Filtrar por paciente (partner UUID, opcional)' },
        estado: { type: 'string', description: 'borrador | presentado | aprobado | en_ejecucion | completado | cancelado' },
      },
      required: [],
    },
  },
  {
    name: 'salud_dental_cuenta_paciente',
    description:
      'Cuenta corriente de un paciente: saldo pendiente, total cargado, total pagado y últimos movimientos ' +
      '(cargos, facturas, notas de crédito y pagos).',
    annotations: { title: 'Cuenta corriente del paciente', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        paciente_id: { type: 'string', description: 'UUID del paciente (partner)' },
      },
      required: ['paciente_id'],
    },
  },
  {
    name: 'salud_dental_buscar_nomenclador',
    description: 'Busca prestaciones en el nomenclador dental (código, nombre, precio de referencia).',
    annotations: { title: 'Buscar nomenclador dental', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en código o nombre (opcional)' },
        limit: { type: 'number', default: 30 },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSaludGetDashboard(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/health/ai-dashboard-data');
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Dashboard Salud\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleSaludBuscarPacientes(args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/health/patients', {
    q: String(args.query),
    limit: Number(args.limit || 20),
  });
  const pacientes = unwrapArray(result);

  if (!pacientes.length) {
    return { content: [{ type: 'text', text: `No hay pacientes que coincidan con "${args.query}".` }] };
  }

  const rows = pacientes.map((p) =>
    `- **${p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}** | ` +
    `DNI: ${p.dni || '—'} | ` +
    `\`${p.id}\``
  );

  return {
    content: [{ type: 'text', text: `## Pacientes (${pacientes.length})\n\n${rows.join('\n')}` }],
  };
}

export async function handleSaludGetPaciente(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.paciente_id);
  const result = await client.get<unknown>(`/api/semilla/health/patients/${encodeURIComponent(id)}`);
  const p = unwrap<Record<string, unknown>>(result);
  if (!p) return { content: [{ type: 'text', text: `No se encontró el paciente ${id}.` }] };

  return {
    content: [{
      type: 'text',
      text:
        `## Paciente\n\n` +
        `- **Nombre:** ${p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}\n` +
        `- **DNI:** ${p.dni || '—'}\n` +
        `- **Fecha nac.:** ${formatDate(String(p.birth_date || ''))}\n` +
        `- **Email:** ${p.email || '—'}\n` +
        `- **Teléfono:** ${p.phone || '—'}\n` +
        `- **Obra social:** ${p.insurance_name || p.insurance || '—'}\n` +
        `- **N° afiliado:** ${p.insurance_member_number || '—'}\n\n` +
        `Para ver historia clínica completa, abrir el paciente en la app web.`,
    }],
  };
}

export async function handleSaludPreviewCrearPaciente(args: Record<string, unknown>) {
  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nuevo paciente\n\n` +
        `- **Nombre:** ${args.nombre} ${args.apellido}\n` +
        `- **DNI:** ${args.dni}\n` +
        (args.fecha_nacimiento ? `- **Fecha nac.:** ${args.fecha_nacimiento}\n` : '') +
        (args.email ? `- **Email:** ${args.email}\n` : '') +
        (args.telefono ? `- **Teléfono:** ${args.telefono}\n` : '') +
        (args.obra_social ? `- **Obra social:** ${args.obra_social}\n` : '') +
        (args.numero_afiliado ? `- **N° afiliado:** ${args.numero_afiliado}\n` : '') +
        `\n---\n⚠️ Para crear, usar \`salud_confirmar_crear_paciente\`.`,
    }],
  };
}

export async function handleSaludConfirmarCrearPaciente(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    first_name: args.nombre,
    last_name: args.apellido,
    dni: args.dni,
  };
  if (args.fecha_nacimiento) body.birth_date = args.fecha_nacimiento;
  if (args.email) body.email = args.email;
  if (args.telefono) body.phone = args.telefono;
  if (args.obra_social) body.insurance_name = args.obra_social;
  if (args.numero_afiliado) body.insurance_member_number = args.numero_afiliado;

  const result = await client.post<unknown>('/api/semilla/health/patients', body);
  const p = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Paciente creado\n\n` +
        `- **ID:** \`${p?.id || '—'}\`\n` +
        `- **Nombre:** ${args.nombre} ${args.apellido}\n` +
        `- **DNI:** ${args.dni}`,
    }],
  };
}

export async function handleSaludListarProfesionales(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | boolean> = {};
  if (args.especialidad) params.specialty = String(args.especialidad);
  if (args.activos !== false) params.active = true;

  const result = await client.get<unknown>('/api/semilla/scheduling/professionals', params);
  const profs = unwrapArray(result);

  if (!profs.length) return { content: [{ type: 'text', text: 'No hay profesionales que coincidan.' }] };

  const rows = profs.map((p) =>
    `- **${p.full_name || p.name}** | ${p.specialty || '—'} | \`${p.id}\``
  );

  return { content: [{ type: 'text', text: `## Profesionales (${profs.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSaludGetHorariosProfesional(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.profesional_id);
  const result = await client.get<unknown>('/api/semilla/scheduling/professional-schedule', { professional_id: id });
  const data = unwrap<unknown>(result);
  return {
    content: [{
      type: 'text',
      text: `## Horarios del profesional ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleSaludGetAgenda(args: Record<string, unknown>) {
  const client = getClient();
  const fecha = args.fecha ? String(args.fecha) : new Date().toISOString().split('T')[0];
  const params: Record<string, string> = { date: fecha };
  if (args.profesional_id) params.professional_id = String(args.profesional_id);

  const result = await client.get<unknown>('/api/semilla/scheduling/appointments/incoming', params);
  const turnos = unwrapArray(result);

  if (!turnos.length) return { content: [{ type: 'text', text: `No hay turnos para el ${fecha}.` }] };

  const rows = turnos
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')))
    .map((t) =>
      `- **${t.start_time || '—'}** | ${t.patient_name || '—'} | ${t.professional_name || '—'} | ${t.status || '—'}`
    );

  return { content: [{ type: 'text', text: `## Agenda — ${fecha} (${turnos.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSaludListarAppointments(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { limit: Number(args.limit || 30) };
  if (args.estado && args.estado !== 'todas') params.status = String(args.estado);
  if (args.profesional_id) params.professional_id = String(args.profesional_id);
  if (args.desde) params.from = String(args.desde);
  if (args.hasta) params.to = String(args.hasta);

  const result = await client.get<unknown>('/api/semilla/health/appointments', params);
  const apps = unwrapArray(result);

  if (!apps.length) return { content: [{ type: 'text', text: 'No hay citas que coincidan.' }] };

  const rows = apps.map((a) =>
    `- ${formatDate(String(a.date || a.start_time || ''))} ${a.start_time || ''} | ` +
    `${a.patient_name || '—'} | ${a.professional_name || '—'} | ${a.status || '—'}`
  );

  return { content: [{ type: 'text', text: `## Citas (${apps.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSaludPreviewCrearAppointment(args: Record<string, unknown>) {
  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nueva cita\n\n` +
        `- **Paciente ID:** ${args.paciente_id}\n` +
        `- **Profesional ID:** ${args.profesional_id}\n` +
        (args.tipo_servicio_id ? `- **Tipo de servicio:** ${args.tipo_servicio_id}\n` : '') +
        `- **Fecha:** ${args.fecha} ${args.hora}\n` +
        (args.notas ? `- **Notas:** ${args.notas}\n` : '') +
        `\n---\n⚠️ Para confirmar, usar \`salud_confirmar_crear_appointment\`.`,
    }],
  };
}

export async function handleSaludConfirmarCrearAppointment(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    patient_id: args.paciente_id,
    professional_id: args.profesional_id,
    date: args.fecha,
    start_time: args.hora,
  };
  if (args.tipo_servicio_id) body.service_type_id = args.tipo_servicio_id;
  if (args.notas) body.notes = args.notas;

  const result = await client.post<unknown>('/api/semilla/health/appointments', body);
  const app = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Cita creada\n\n` +
        `- **ID:** \`${app?.id || '—'}\`\n` +
        `- **Fecha:** ${args.fecha} ${args.hora}`,
    }],
  };
}

export async function handleSaludListarRecetas(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { limit: Number(args.limit || 30) };
  if (args.paciente_id) params.patient_id = String(args.paciente_id);
  if (args.profesional_id) params.professional_id = String(args.profesional_id);

  const result = await client.get<unknown>('/api/semilla/health/pharmacy/recetas', params);
  const recetas = unwrapArray(result);

  if (!recetas.length) return { content: [{ type: 'text', text: 'No hay recetas que coincidan.' }] };

  const rows = recetas.map((r) =>
    `- ${formatDate(String(r.date || ''))} | Paciente: ${r.patient_name || r.patient_id} | ` +
    `Profesional: ${r.professional_name || r.professional_id} | Estado: ${r.status || '—'}`
  );

  return { content: [{ type: 'text', text: `## Recetas (${recetas.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSaludDentalListarPresupuestos(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = {};
  if (args.paciente_id) params.partner_id = String(args.paciente_id);
  if (args.estado) params.estado = String(args.estado);

  const result = await client.get<unknown>('/api/semilla/verticals/health/dental/presupuestos', params);
  const presupuestos = unwrapArray(result);

  if (!presupuestos.length) return { content: [{ type: 'text', text: 'No hay presupuestos que coincidan.' }] };

  const fmt = (n: unknown) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const rows = presupuestos.map((p) =>
    `- **${p.numero}** | ${formatDate(String(p.fecha || ''))} | Estado: ${p.estado} | ` +
    `Total: ${fmt(p.monto_total)} | Paciente: ${fmt(p.monto_paciente)} | OS: ${fmt(p.monto_os)}`
  );

  return { content: [{ type: 'text', text: `## Presupuestos dentales (${presupuestos.length})\n\n${rows.join('\n')}` }] };
}

export async function handleSaludDentalCuentaPaciente(args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>(
    `/api/semilla/verticals/health/dental/pacientes/${String(args.paciente_id)}/cuenta`
  );
  const data = unwrap<Record<string, unknown>>(result);

  const fmt = (n: unknown) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const movimientos = Array.isArray(data?.movimientos) ? (data.movimientos as Record<string, unknown>[]) : [];
  const rows = movimientos.slice(0, 10).map((m) =>
    `- ${formatDate(String(m.fecha || ''))} | ${m.tipo_label} ${m.numero || ''} | ${fmt(m.importe)}`
  );

  return {
    content: [{
      type: 'text',
      text:
        `## Cuenta corriente del paciente\n\n` +
        `- **Saldo pendiente:** ${fmt(data?.saldo)}\n` +
        `- Total cargado: ${fmt(data?.total_cargado)}\n` +
        `- Total pagado: ${fmt(data?.total_pagado)}\n\n` +
        `### Últimos movimientos\n${rows.join('\n') || '(sin movimientos)'}`,
    }],
  };
}

export async function handleSaludDentalBuscarNomenclador(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { pageSize: Number(args.limit || 30) };
  if (args.query) params.search = String(args.query);

  const result = await client.get<unknown>('/api/semilla/generic/dental_nomenclador', params);
  const items = unwrapArray(result);

  if (!items.length) return { content: [{ type: 'text', text: 'No hay prestaciones en el nomenclador con ese criterio.' }] };

  const fmt = (n: unknown) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  const rows = items.map((i) =>
    `- **${i.codigo}** | ${i.nombre}${i.precio_referencia ? ` | Ref: ${fmt(i.precio_referencia)}` : ''}`
  );

  return { content: [{ type: 'text', text: `## Nomenclador dental (${items.length})\n\n${rows.join('\n')}` }] };
}
