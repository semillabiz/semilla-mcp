/**
 * Tools de Asistencia (HR) para Semilla MCP.
 * Endpoints: /api/semilla/hr/attendance
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap, unwrapArray } from '../client.js';

export const hrAttendanceTools: Tool[] = [
  {
    name: 'hr_get_asistencia_hoy',
    description: 'Muestra los registros de entrada/salida del día actual para todos los empleados o uno específico.',
    annotations: { title: 'Consultar asistencia de hoy', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado (opcional, default: todos)' },
      },
      required: [],
    },
  },
  {
    name: 'hr_check_in',
    description: 'Registra la entrada (check-in) de un empleado.',
    annotations: { title: 'Registrar entrada', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado' },
        hora: { type: 'string', description: 'Hora de entrada HH:MM (opcional, default: ahora)' },
      },
      required: ['empleado_id'],
    },
  },
  {
    name: 'hr_check_out',
    description: 'Registra la salida (check-out) de un empleado.',
    annotations: { title: 'Registrar salida', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado' },
        hora: { type: 'string', description: 'Hora de salida HH:MM (opcional, default: ahora)' },
      },
      required: ['empleado_id'],
    },
  },
  {
    name: 'hr_get_historial_asistencia',
    description: 'Historial de asistencia de un empleado para un rango de fechas.',
    annotations: { title: 'Consultar historial de asistencia', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        empleado_id: { type: 'string', description: 'UUID del empleado' },
        desde: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        limit: { type: 'number', default: 30 },
      },
      required: ['empleado_id'],
    },
  },
  {
    name: 'hr_get_reporte_asistencia',
    description: 'Reporte de asistencia por período: horas trabajadas, ausencias, tardanzas.',
    annotations: { title: 'Reporte de asistencia', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Fecha desde YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha hasta YYYY-MM-DD' },
        empleado_id: { type: 'string', description: 'Filtrar por empleado (opcional)' },
      },
      required: ['desde', 'hasta'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleHrGetAsistenciaHoy(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string> = {};
    if (args.empleado_id) params.employee_id = String(args.empleado_id);

    const result = await client.get<unknown>('/api/semilla/hr/attendance/today', params);
    const records = unwrapArray(result);

    if (!records.length) {
      return { content: [{ type: 'text', text: 'No hay registros de asistencia para hoy.' }] };
    }

    const rows = records.map((r) =>
      `- **${r.employee_name || r.employee_id || '—'}** | ` +
      `Entrada: ${r.check_in ? String(r.check_in).slice(11, 16) : '—'} | ` +
      `Salida: ${r.check_out ? String(r.check_out).slice(11, 16) : 'pendiente'}`
    );

    return {
      content: [{ type: 'text', text: `## Asistencia hoy (${records.length})\n\n${rows.join('\n')}` }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al obtener asistencia: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}

export async function handleHrCheckIn(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body: Record<string, unknown> = { employee_id: args.empleado_id };
    if (args.hora) body.check_in_time = args.hora;

    const result = await client.post<unknown>('/api/semilla/hr/attendance/check-in', body);
    const data = unwrap<Record<string, unknown>>(result);

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Check-in registrado\n\n` +
          `- **Empleado:** ${data?.employee_name || args.empleado_id}\n` +
          `- **Hora entrada:** ${data?.check_in ? String(data.check_in).slice(11, 16) : (args.hora || 'ahora')}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al registrar check-in: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleHrCheckOut(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body: Record<string, unknown> = { employee_id: args.empleado_id };
    if (args.hora) body.check_out_time = args.hora;

    const result = await client.post<unknown>('/api/semilla/hr/attendance/check-out', body);
    const data = unwrap<Record<string, unknown>>(result);

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Check-out registrado\n\n` +
          `- **Empleado:** ${data?.employee_name || args.empleado_id}\n` +
          `- **Hora salida:** ${data?.check_out ? String(data.check_out).slice(11, 16) : (args.hora || 'ahora')}\n` +
          (data?.worked_hours ? `- **Horas trabajadas:** ${Number(data.worked_hours).toFixed(2)}h` : ''),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al registrar check-out: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleHrGetHistorialAsistencia(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string | number> = {
      employee_id: String(args.empleado_id),
      limit: Number(args.limit || 30),
    };
    if (args.desde) params.from = String(args.desde);
    if (args.hasta) params.to = String(args.hasta);

    const result = await client.get<unknown>('/api/semilla/hr/attendance', params);
    const records = unwrapArray(result);

    if (!records.length) {
      return { content: [{ type: 'text', text: 'No hay registros de asistencia para el período.' }] };
    }

    const rows = records.map((r) =>
      `- ${formatDate(String(r.check_in || ''))} | ` +
      `Entrada: ${r.check_in ? String(r.check_in).slice(11, 16) : '—'} | ` +
      `Salida: ${r.check_out ? String(r.check_out).slice(11, 16) : '—'} | ` +
      `${r.worked_hours ? Number(r.worked_hours).toFixed(2) + 'h' : '—'}`
    );

    return {
      content: [{ type: 'text', text: `## Historial asistencia (${records.length})\n\n${rows.join('\n')}` }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al obtener historial: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}

export async function handleHrGetReporteAsistencia(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string> = {
      from: String(args.desde),
      to: String(args.hasta),
    };
    if (args.empleado_id) params.employee_id = String(args.empleado_id);

    const result = await client.get<unknown>('/api/semilla/hr/attendance/report', params);
    const data = unwrap<Record<string, unknown>>(result);

    return {
      content: [{
        type: 'text',
        text:
          `## Reporte de asistencia (${args.desde} → ${args.hasta})\n\n` +
          `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al generar reporte: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}
