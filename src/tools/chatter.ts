/**
 * Tools de Chatter (mensajes y actividades) para Semilla MCP.
 * Endpoints: /api/semilla/chatter
 *
 * Permite leer mensajes/notas de cualquier registro y agregar notas internas.
 * Los modelos soportados son: account.move, sale.order, purchase.order, res.partner, etc.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap, unwrapArray } from '../client.js';

export const chatterTools: Tool[] = [
  {
    name: 'chatter_listar_mensajes',
    description:
      'Lista mensajes y notas del chatter de un registro (factura, orden, cliente, etc.). ' +
      'Útil para ver el historial de comunicación de un documento.',
    annotations: { title: 'Listar mensajes del chatter', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        modelo: {
          type: 'string',
          description: 'Nombre del modelo (ej: account.move, sale.order, purchase.order, res.partner)',
        },
        registro_id: {
          type: 'string',
          description: 'UUID del registro',
        },
        limit: { type: 'number', default: 20 },
      },
      required: ['modelo', 'registro_id'],
    },
  },
  {
    name: 'chatter_agregar_nota',
    description: 'Agrega una nota interna al chatter de un registro (no se envía al cliente).',
    annotations: { title: 'Agregar nota', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        modelo: {
          type: 'string',
          description: 'Nombre del modelo (ej: account.move, sale.order, res.partner)',
        },
        registro_id: {
          type: 'string',
          description: 'UUID del registro',
        },
        nota: {
          type: 'string',
          description: 'Texto de la nota interna',
        },
      },
      required: ['modelo', 'registro_id', 'nota'],
    },
  },
  {
    name: 'chatter_listar_actividades',
    description:
      'Lista actividades pendientes de un registro o de todos los registros del tenant. ' +
      'Las actividades son tareas programadas (llamar, reunión, enviar email, etc.).',
    annotations: { title: 'Listar actividades', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        modelo: {
          type: 'string',
          description: 'Filtrar por modelo (opcional)',
        },
        registro_id: {
          type: 'string',
          description: 'Filtrar por registro específico (opcional)',
        },
        vencidas: {
          type: 'boolean',
          description: 'Solo actividades vencidas (default: false)',
          default: false,
        },
        limit: { type: 'number', default: 20 },
      },
      required: [],
    },
  },
  {
    name: 'chatter_completar_actividad',
    description: 'Marca una actividad como completada.',
    annotations: { title: 'Completar actividad', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        actividad_id: {
          type: 'string',
          description: 'UUID de la actividad',
        },
        feedback: {
          type: 'string',
          description: 'Comentario de cierre (opcional)',
        },
      },
      required: ['actividad_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleChatterListarMensajes(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string | number> = {
      model: String(args.modelo),
      res_id: String(args.registro_id),
      limit: Number(args.limit || 20),
    };

    const result = await client.get<unknown>('/api/semilla/chatter/messages', params);
    const messages = unwrapArray(result);

    if (!messages.length) {
      return { content: [{ type: 'text', text: 'No hay mensajes en el chatter de este registro.' }] };
    }

    const rows = messages.map((m) => {
      const fecha = formatDate(String(m.date || m.create_date || ''));
      const autor = m.author_name || m.author_id || '—';
      const tipo = m.message_type === 'comment' ? '💬' : m.message_type === 'note' ? '📝' : '📧';
      const texto = String(m.body || m.text || '').replace(/<[^>]*>/g, '').trim().slice(0, 200);
      return `${tipo} **${fecha}** | ${autor}\n   ${texto}`;
    });

    return {
      content: [{ type: 'text', text: `## Chatter (${messages.length} mensajes)\n\n${rows.join('\n\n')}` }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al listar mensajes: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}

export async function handleChatterAgregarNota(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const body = {
      model: String(args.modelo),
      res_id: String(args.registro_id),
      body: String(args.nota),
      message_type: 'note',
    };

    const result = await client.post<unknown>('/api/semilla/chatter/messages', body);
    const data = unwrap<Record<string, unknown>>(result);

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Nota agregada\n\n` +
          `- **Registro:** ${args.modelo} / ${args.registro_id}\n` +
          `- **ID mensaje:** \`${data?.id || '—'}\`\n` +
          `- **Nota:** ${args.nota}`,
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al agregar nota: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}

export async function handleChatterListarActividades(args: Record<string, unknown>) {
  const client = getClient();
  try {
    const params: Record<string, string | number | boolean> = {
      limit: Number(args.limit || 20),
    };
    if (args.modelo) params.model = String(args.modelo);
    if (args.registro_id) params.res_id = String(args.registro_id);
    if (args.vencidas) params.overdue = true;

    const result = await client.get<unknown>('/api/semilla/chatter/activities', params);
    const activities = unwrapArray(result);

    if (!activities.length) {
      return { content: [{ type: 'text', text: 'No hay actividades pendientes.' }] };
    }

    const rows = activities.map((a) => {
      const vence = formatDate(String(a.date_deadline || ''));
      const vencida = a.date_deadline && new Date(String(a.date_deadline)) < new Date() ? ' ⚠️ VENCIDA' : '';
      return `- **${a.activity_type_name || a.activity_type || '—'}** | ` +
        `${a.res_name || a.res_id || '—'} | ` +
        `Vence: ${vence}${vencida} | ` +
        `Responsable: ${a.user_name || '—'} | ` +
        `\`${a.id}\``;
    });

    return {
      content: [{ type: 'text', text: `## Actividades pendientes (${activities.length})\n\n${rows.join('\n')}` }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al listar actividades: ${(err as Error).message}. Verificá estar autenticado con \`login_semilla\`.`,
      }],
      isError: true,
    };
  }
}

export async function handleChatterCompletarActividad(args: Record<string, unknown>) {
  const client = getClient();
  const actividadId = String(args.actividad_id);
  try {
    const body: Record<string, unknown> = {};
    if (args.feedback) body.feedback = args.feedback;

    await client.post<unknown>(
      `/api/semilla/chatter/activities/${encodeURIComponent(actividadId)}/done`,
      body
    );

    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Actividad completada\n\n` +
          `- **ID:** \`${actividadId}\`\n` +
          (args.feedback ? `- **Feedback:** ${args.feedback}` : ''),
      }],
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error al completar actividad: ${(err as Error).message}.`,
      }],
      isError: true,
    };
  }
}
