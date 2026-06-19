/**
 * Tools de Hotelería para Semilla MCP.
 * Endpoints: /api/semilla/hospitality + generic /api/semilla/generic/:model
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate, unwrap, unwrapArray } from '../client.js';

export const hospitalityTools: Tool[] = [
  {
    name: 'hosp_get_dashboard',
    description: 'Resumen del módulo Hotelería: ocupación actual, check-ins/outs del día, RevPAR, ADR.',
    annotations: { title: 'Dashboard de Hotelería', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'hosp_listar_habitaciones',
    description: 'Lista todas las habitaciones del hotel con su tipo, estado actual y tarifa base.',
    annotations: { title: 'Listar habitaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo_id: { type: 'string', description: 'Filtrar por tipo de habitación (opcional)' },
        estado: {
          type: 'string',
          enum: ['todas', 'libre', 'ocupada', 'limpieza', 'mantenimiento'],
          default: 'todas',
        },
        limit: { type: 'number', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'hosp_listar_tipos_habitacion',
    description: 'Lista los tipos de habitación (Standard, Suite, etc.) con tarifa base, capacidad y descripción.',
    annotations: { title: 'Listar tipos de habitación', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'hosp_get_disponibilidad',
    description:
      'Verifica disponibilidad de habitaciones para un rango de fechas. ' +
      'Útil para responder "¿hay habitaciones libres del 10 al 15?".',
    annotations: { title: 'Disponibilidad de habitaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        fecha_entrada: { type: 'string', description: 'Check-in YYYY-MM-DD' },
        fecha_salida: { type: 'string', description: 'Check-out YYYY-MM-DD' },
        tipo_id: { type: 'string', description: 'Filtrar por tipo de habitación (opcional)' },
      },
      required: ['fecha_entrada', 'fecha_salida'],
    },
  },
  {
    name: 'hosp_listar_reservas',
    description: 'Lista reservas con filtros por estado y rango de fechas.',
    annotations: { title: 'Listar reservas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['todas', 'confirmada', 'check_in', 'check_out', 'cancelada'],
          default: 'todas',
        },
        desde: { type: 'string', description: 'Fecha desde YYYY-MM-DD (opcional)' },
        hasta: { type: 'string', description: 'Fecha hasta YYYY-MM-DD (opcional)' },
        limit: { type: 'number', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'hosp_preview_crear_reserva',
    description:
      'PASO 1: Previsualiza una nueva reserva. ' +
      'Calcula noches y total estimado. Después usar `hosp_confirmar_crear_reserva`.',
    annotations: { title: 'Vista previa: crear reserva', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        habitacion_id: { type: 'string', description: 'UUID de la habitación' },
        tipo_habitacion_id: { type: 'string', description: 'UUID del tipo de habitación (alternativa a habitacion_id)' },
        fecha_entrada: { type: 'string', description: 'Check-in YYYY-MM-DD' },
        fecha_salida: { type: 'string', description: 'Check-out YYYY-MM-DD' },
        huesped_nombre: { type: 'string' },
        huesped_email: { type: 'string' },
        huesped_telefono: { type: 'string' },
        comensales: { type: 'number', description: 'Cantidad de huéspedes', default: 1 },
        tarifa_noche: { type: 'number', description: 'Tarifa por noche en pesos (opcional, usa la del tipo si no se pasa)' },
        notas: { type: 'string' },
      },
      required: ['fecha_entrada', 'fecha_salida', 'huesped_nombre'],
    },
  },
  {
    name: 'hosp_confirmar_crear_reserva',
    description: 'PASO 2: Crea efectivamente la reserva en el sistema.',
    annotations: { title: 'Crear reserva', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        habitacion_id: { type: 'string' },
        tipo_habitacion_id: { type: 'string' },
        fecha_entrada: { type: 'string' },
        fecha_salida: { type: 'string' },
        huesped_nombre: { type: 'string' },
        huesped_email: { type: 'string' },
        huesped_telefono: { type: 'string' },
        comensales: { type: 'number', default: 1 },
        tarifa_noche: { type: 'number' },
        notas: { type: 'string' },
      },
      required: ['fecha_entrada', 'fecha_salida', 'huesped_nombre'],
    },
  },
  {
    name: 'hosp_check_in',
    description: 'Marca una reserva como check-in: ocupar la habitación y registrar la entrada del huésped.',
    annotations: { title: 'Check-in', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        reserva_id: { type: 'string', description: 'UUID de la reserva' },
      },
      required: ['reserva_id'],
    },
  },
  {
    name: 'hosp_check_out',
    description: 'Marca una reserva como check-out: liberar habitación, marcar pendiente de limpieza y cerrar.',
    annotations: { title: 'Check-out', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        reserva_id: { type: 'string', description: 'UUID de la reserva' },
      },
      required: ['reserva_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleHospGetDashboard(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/hospitality/dashboard-stats');
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Dashboard Hotelería\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleHospListarHabitaciones(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { limit: Number(args.limit || 50) };
  if (args.tipo_id) params.room_type_id = String(args.tipo_id);
  if (args.estado && args.estado !== 'todas') params.status = String(args.estado);

  const result = await client.get<unknown>('/api/semilla/generic/rooms', params);
  const rooms = unwrapArray(result);

  if (!rooms.length) {
    return { content: [{ type: 'text', text: 'No hay habitaciones que coincidan.' }] };
  }

  const rows = rooms.map((r) =>
    `- **${r.name || r.number || r.id}** | ${r.room_type_name || '—'} | ${r.status || '—'}` +
    (r.base_price ? ` | ${formatCurrency(Number(r.base_price))}/noche` : '')
  );

  return {
    content: [{ type: 'text', text: `## Habitaciones (${rooms.length})\n\n${rows.join('\n')}` }],
  };
}

export async function handleHospListarTiposHabitacion(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/generic/room_types');
  const tipos = unwrapArray(result);

  if (!tipos.length) {
    return { content: [{ type: 'text', text: 'No hay tipos de habitación cargados.' }] };
  }

  const rows = tipos.map((t) =>
    `- **${t.name}** | Capacidad: ${t.capacity || '—'} | Tarifa base: ${formatCurrency(Number(t.base_price || 0))}`
  );

  return {
    content: [{ type: 'text', text: `## Tipos de habitación (${tipos.length})\n\n${rows.join('\n')}` }],
  };
}

export async function handleHospGetDisponibilidad(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string> = {
    check_in: String(args.fecha_entrada),
    check_out: String(args.fecha_salida),
  };
  if (args.tipo_id) params.room_type_id = String(args.tipo_id);

  const result = await client.get<unknown>('/api/semilla/hospitality/availability', params);
  const data = unwrap<unknown>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Disponibilidad ${args.fecha_entrada} → ${args.fecha_salida}\n\n` +
        '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    }],
  };
}

export async function handleHospListarReservas(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number> = { limit: Number(args.limit || 30) };
  if (args.estado && args.estado !== 'todas') params.status = String(args.estado);
  if (args.desde) params.from = String(args.desde);
  if (args.hasta) params.to = String(args.hasta);

  const result = await client.get<unknown>('/api/semilla/generic/reservations', params);
  const reservas = unwrapArray(result);

  if (!reservas.length) {
    return { content: [{ type: 'text', text: 'No hay reservas que coincidan.' }] };
  }

  const rows = reservas.map((r) =>
    `- **${r.guest_name || r.partner_name || '—'}** | Hab. ${r.room_name || r.room_id || '—'} | ` +
    `${formatDate(String(r.check_in || ''))} → ${formatDate(String(r.check_out || ''))} | ` +
    `${r.status || '—'} | ${formatCurrency(Number(r.total || 0))}`
  );

  return {
    content: [{ type: 'text', text: `## Reservas (${reservas.length})\n\n${rows.join('\n')}` }],
  };
}

function calcularNoches(entrada: string, salida: string): number {
  const ms = new Date(salida).getTime() - new Date(entrada).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export async function handleHospPreviewCrearReserva(args: Record<string, unknown>) {
  const noches = calcularNoches(String(args.fecha_entrada), String(args.fecha_salida));
  const tarifa = Number(args.tarifa_noche || 0);
  const total = tarifa * noches;

  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nueva reserva\n\n` +
        `- **Huésped:** ${args.huesped_nombre}\n` +
        `- **Check-in:** ${args.fecha_entrada}\n` +
        `- **Check-out:** ${args.fecha_salida}\n` +
        `- **Noches:** ${noches}\n` +
        `- **Comensales:** ${args.comensales || 1}\n` +
        (args.habitacion_id ? `- **Habitación:** ${args.habitacion_id}\n` : '') +
        (args.tipo_habitacion_id ? `- **Tipo:** ${args.tipo_habitacion_id}\n` : '') +
        (tarifa ? `- **Tarifa por noche:** ${formatCurrency(tarifa)}\n- **Total estimado:** ${formatCurrency(total)}\n` : '') +
        (args.notas ? `- **Notas:** ${args.notas}\n` : '') +
        `\n---\n⚠️ Para confirmar, usar \`hosp_confirmar_crear_reserva\`.`,
    }],
  };
}

export async function handleHospConfirmarCrearReserva(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    check_in: args.fecha_entrada,
    check_out: args.fecha_salida,
    guest_name: args.huesped_nombre,
    guests: args.comensales || 1,
  };
  if (args.habitacion_id) body.room_id = args.habitacion_id;
  if (args.tipo_habitacion_id) body.room_type_id = args.tipo_habitacion_id;
  if (args.huesped_email) body.guest_email = args.huesped_email;
  if (args.huesped_telefono) body.guest_phone = args.huesped_telefono;
  if (args.tarifa_noche) body.nightly_rate = args.tarifa_noche;
  if (args.notas) body.notes = args.notas;

  const result = await client.post<unknown>('/api/semilla/hospitality/reservations', body);
  const reserva = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Reserva creada\n\n` +
        `- **ID:** \`${reserva?.id || '—'}\`\n` +
        `- **Huésped:** ${args.huesped_nombre}\n` +
        `- **Habitación:** ${reserva?.room_name || reserva?.room_id || '—'}\n` +
        `- **Total:** ${formatCurrency(Number(reserva?.total || 0))}`,
    }],
  };
}

export async function handleHospCheckIn(args: Record<string, unknown>) {
  const client = getClient();
  const reservaId = String(args.reserva_id);
  await client.post(`/api/semilla/hospitality/reservations/${encodeURIComponent(reservaId)}/check-in`, {});
  return {
    content: [{ type: 'text', text: `✅ Check-in realizado para la reserva ${reservaId}.` }],
  };
}

export async function handleHospCheckOut(args: Record<string, unknown>) {
  const client = getClient();
  const reservaId = String(args.reserva_id);
  await client.post(`/api/semilla/hospitality/reservations/${encodeURIComponent(reservaId)}/check-out`, {});
  return {
    content: [{ type: 'text', text: `✅ Check-out realizado para la reserva ${reservaId}. Habitación pendiente de limpieza.` }],
  };
}
