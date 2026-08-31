/**
 * Tools de Automatizaciones para Semilla MCP.
 * Endpoints: /api/semilla/automations
 *
 * El grafo (`graph: {nodes, edges}`) lo arma el LLM del cliente MCP en lenguaje
 * natural → JSON estructurado. Este módulo no hace parsing de texto: solo
 * expone catálogo, listado, dry-run y alta/toggle de reglas con el patrón
 * preview → confirmar para las escrituras.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap, unwrapArray } from '../client.js';

export const automationsTools: Tool[] = [
  {
    name: 'automations_catalogo_nodos',
    description:
      'Catálogo completo de nodos disponibles para armar automatizaciones: eventos y presets de schedule ' +
      'para triggers, operadores y campos por modelo para condiciones, tipos de acción con su config_schema, ' +
      'y unidades de delay. Llamar SIEMPRE antes de armar un grafo nuevo con `automations_preview_crear_regla`, ' +
      'para no inventar nombres de eventos, campos o acciones que no existen.',
    annotations: { title: 'Catálogo de nodos de automatización', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'automations_listar',
    description: 'Lista las reglas de automatización del tenant, con su trigger, cantidad de ejecuciones y errores.',
    annotations: { title: 'Listar automatizaciones', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        solo_activas: { type: 'boolean', description: 'Si es true, muestra solo reglas activas', default: false },
      },
      required: [],
    },
  },
  {
    name: 'automations_probar_regla',
    description:
      'Simula la ejecución de una regla (dry-run) con datos de ejemplo, paso a paso. Es una simulación real: ' +
      'no manda emails/webhooks de verdad ni persiste nada, así que es seguro llamarla libremente sin pedir ' +
      'confirmación. Pasar `graph` (para probar un grafo todavía no guardado) o `regla_id` (para probar una regla ' +
      'existente) — al menos uno de los dos es obligatorio.',
    annotations: { title: 'Probar automatización (dry-run)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        graph: { type: 'object', description: 'Grafo {nodes, edges} a probar (si no se pasa regla_id)' },
        regla_id: { type: 'string', description: 'ID de una regla existente a probar (si no se pasa graph)' },
        datos_ejemplo: { type: 'object', description: 'Datos de ejemplo (sample_data) para simular el trigger' },
      },
      required: ['datos_ejemplo'],
    },
  },
  {
    name: 'automations_preview_crear_regla',
    description:
      'PASO 1: Previsualiza una nueva regla de automatización a partir de un grafo ya armado (recomendado usar ' +
      'antes `automations_catalogo_nodos` para no inventar eventos/campos/acciones). No llama al ERP ni crea nada. ' +
      'Después usar `automations_confirmar_crear_regla` con los mismos parámetros.',
    annotations: { title: 'Previsualizar automatización (paso 1)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        descripcion: { type: 'string' },
        graph: { type: 'object', description: 'Grafo {nodes, edges} de la automatización' },
        activar_al_crear: { type: 'boolean', description: 'Si la regla queda activa al crearla (default true)' },
      },
      required: ['nombre', 'graph'],
    },
  },
  {
    name: 'automations_confirmar_crear_regla',
    description: 'PASO 2: Crea la regla de automatización. Si el grafo es inválido, el ERP devuelve el motivo exacto para corregirlo.',
    annotations: { title: 'Confirmar automatización (paso 2)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        descripcion: { type: 'string' },
        graph: { type: 'object', description: 'Grafo {nodes, edges} de la automatización' },
        activar_al_crear: { type: 'boolean', description: 'Si la regla queda activa al crearla (default true)' },
      },
      required: ['nombre', 'graph'],
    },
  },
  {
    name: 'automations_preview_activar_desactivar',
    description: 'PASO 1: Previsualiza activar o desactivar una regla existente. Después usar `automations_confirmar_activar_desactivar`.',
    annotations: { title: 'Previsualizar activar/desactivar (paso 1)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        regla_id: { type: 'string' },
        activar: { type: 'boolean', description: 'true para activar, false para desactivar' },
      },
      required: ['regla_id', 'activar'],
    },
  },
  {
    name: 'automations_confirmar_activar_desactivar',
    description:
      'PASO 2: Activa o desactiva la regla. Antes de togglear, chequea el estado actual y no hace nada si ya está en el estado pedido.',
    annotations: { title: 'Confirmar activar/desactivar (paso 2)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        regla_id: { type: 'string' },
        activar: { type: 'boolean', description: 'true para activar, false para desactivar' },
      },
      required: ['regla_id', 'activar'],
    },
  },
];

// ─── Helpers de formateo ───────────────────────────────────────────────────────

function resumirTrigger(nodes: any[]): string {
  const trigger = (nodes || []).find((n) => n?.type === 'trigger');
  if (!trigger) return '— (sin trigger)';
  const data = trigger.data || trigger;
  if (data.trigger_type === 'schedule') return `Programado — cron \`${data.trigger_cron || '—'}\``;
  if (data.trigger_type === 'event') return `Evento \`${data.trigger_event || '—'}\`${data.trigger_model ? ` (modelo: ${data.trigger_model})` : ''}`;
  return JSON.stringify(data);
}

function resumirFlujo(graph: Record<string, unknown>): string {
  const nodes = (graph?.nodes as any[]) || [];
  const edges = (graph?.edges as any[]) || [];
  const lineas: string[] = [];
  lineas.push(`- **Trigger:** ${resumirTrigger(nodes)}`);

  const condiciones = nodes.filter((n) => n?.type === 'condition');
  for (const c of condiciones) {
    const conds = (c.data?.conditions || c.conditions || []) as any[];
    const desc = conds.map((cc) => `${cc.field} ${cc.operator} ${JSON.stringify(cc.value)}`).join(` ${conds[0]?.logic || 'AND'} `);
    lineas.push(`- **Condición** \`${c.id}\`: ${desc || '—'}`);
  }

  const acciones = nodes.filter((n) => n?.type === 'action');
  for (const a of acciones) {
    const d = a.data || a;
    lineas.push(`- **Acción** \`${a.id}\`: ${d.action_type || '—'} — \`${JSON.stringify(d.config || {})}\``);
  }

  const delays = nodes.filter((n) => n?.type === 'delay');
  for (const d of delays) {
    const dd = d.data || d;
    lineas.push(`- **Delay** \`${d.id}\`: ${dd.amount} ${dd.unit}`);
  }

  if (edges.length) {
    lineas.push(`- **Conexiones (${edges.length}):** ` + edges.map((e) => `${e.source}${e.sourceHandle ? `[${e.sourceHandle}]` : ''} → ${e.target}`).join(', '));
  }

  return lineas.join('\n');
}

const ICONO_STATUS: Record<string, string> = { success: '✅', failed: '❌', skipped: '⏭️' };

function formatearTrace(trace: any[]): string {
  if (!trace?.length) return 'Sin pasos en el trace.';
  return trace
    .map((t, i) => {
      const icono = ICONO_STATUS[t.status] || '•';
      let linea = `${i + 1}. ${icono} **${t.type}** (\`${t.node_id}\`) — ${t.status}`;
      if (t.duration_ms != null) linea += ` (${t.duration_ms}ms)`;
      if (t.status === 'failed' && t.error) linea += `\n   ↳ Error: ${t.error}`;
      if (t.result != null) linea += `\n   ↳ Resultado: \`${JSON.stringify(t.result)}\``;
      return linea;
    })
    .join('\n');
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function handleAutomationsCatalogoNodos(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/automations/meta/nodes');
  const meta = unwrap<Record<string, any>>(result) || {};

  const partes: string[] = ['## Catálogo de nodos de automatización'];

  const events = meta.triggers?.events || [];
  const presets = meta.triggers?.schedule_presets || [];
  partes.push('\n### Triggers — eventos');
  partes.push(events.length ? events.map((e: any) => `- \`${e.value}\` — ${e.label}`).join('\n') : '(sin eventos)');
  partes.push('\n### Triggers — presets de schedule');
  partes.push(presets.length ? presets.map((p: any) => `- \`${p.value}\` — ${p.label} (cron: \`${p.cron}\`)`).join('\n') : '(sin presets)');

  const operators = meta.conditions?.operators || [];
  partes.push('\n### Condiciones — operadores');
  partes.push(operators.length ? operators.map((o: any) => `- \`${o.value}\` — ${o.label}`).join('\n') : '(sin operadores)');

  const fieldsByModel = meta.conditions?.fields_by_model || {};
  partes.push('\n### Condiciones — campos por modelo');
  const modelos = Object.keys(fieldsByModel);
  if (!modelos.length) {
    partes.push('(sin modelos)');
  } else {
    for (const modelo of modelos) {
      const campos = fieldsByModel[modelo] || [];
      partes.push(`**${modelo}:**`);
      partes.push(campos.map((f: any) => `- \`${f.value}\` (${f.type}) — ${f.label}`).join('\n'));
    }
  }

  const actions = meta.actions || [];
  partes.push('\n### Acciones disponibles');
  partes.push(
    actions.length
      ? actions.map((a: any) => `- \`${a.type}\` — ${a.label}\n  config_schema: \`${JSON.stringify(a.config_schema)}\``).join('\n')
      : '(sin acciones)'
  );

  const delayUnits = meta.delay?.units || [];
  partes.push('\n### Delay — unidades');
  partes.push(delayUnits.length ? delayUnits.map((u: string) => `\`${u}\``).join(', ') : '(sin unidades)');

  return { content: [{ type: 'text', text: partes.join('\n') }] };
}

export async function handleAutomationsListar(args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/automations');
  let reglas = unwrapArray<Record<string, any>>(result);

  if (args.solo_activas) reglas = reglas.filter((r) => r.active);

  if (!reglas.length) return { content: [{ type: 'text', text: 'No hay reglas de automatización.' }] };

  const rows = reglas.map((r) => {
    const nodes = r.graph?.nodes || [];
    const estado = r.active ? '🟢 activa' : '⚪ inactiva';
    return (
      `- **${r.name}** (${estado}) | \`${r.id}\`\n` +
      `  - Trigger: ${resumirTrigger(nodes)}\n` +
      `  - Ejecuciones: ${r.run_count ?? 0} | Errores: ${r.error_count ?? 0}` +
      (r.last_run_at ? ` | Última corrida: ${r.last_run_at}` : '')
    );
  });

  return { content: [{ type: 'text', text: `## Automatizaciones (${reglas.length})\n\n${rows.join('\n')}` }] };
}

export async function handleAutomationsProbarRegla(args: Record<string, unknown>) {
  if (!args.graph && !args.regla_id) {
    return {
      content: [{
        type: 'text',
        text: 'Error: hay que pasar `graph` (para probar un grafo nuevo) o `regla_id` (para probar una regla existente).',
      }],
    };
  }

  const client = getClient();
  const body = { sample_data: args.datos_ejemplo ?? {} };

  let result: unknown;
  if (args.regla_id) {
    result = await client.post<unknown>(`/api/semilla/automations/${args.regla_id}/dry-run`, body);
  } else {
    result = await client.post<unknown>('/api/semilla/automations/dry-run', { ...body, graph: args.graph });
  }

  const data = unwrap<Record<string, any>>(result) || {};
  const trace = data.trace || [];

  return {
    content: [{
      type: 'text',
      text: `## Resultado de la simulación (dry-run)\n\n${formatearTrace(trace)}\n\n_No se envió nada real ni se persistió nada._`,
    }],
  };
}

export async function handleAutomationsPreviewCrearRegla(args: Record<string, unknown>) {
  const graph = (args.graph || {}) as Record<string, unknown>;
  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Nueva automatización\n\n` +
        `- **Nombre:** ${args.nombre}\n` +
        (args.descripcion ? `- **Descripción:** ${args.descripcion}\n` : '') +
        `- **Se activa al crear:** ${args.activar_al_crear === false ? 'No' : 'Sí'}\n\n` +
        `### Flujo\n${resumirFlujo(graph)}\n\n` +
        `---\n⚠️ Para confirmar, usar \`automations_confirmar_crear_regla\` con los mismos parámetros.`,
    }],
  };
}

export async function handleAutomationsConfirmarCrearRegla(args: Record<string, unknown>) {
  const client = getClient();
  const body = {
    name: args.nombre,
    description: args.descripcion,
    graph: args.graph,
    active: args.activar_al_crear ?? true,
  };

  try {
    const result = await client.post<unknown>('/api/semilla/automations', body);
    const regla = unwrap<Record<string, any>>(result);
    return {
      content: [{
        type: 'text',
        text:
          `## ✅ Automatización creada\n\n` +
          `- **ID:** \`${regla?.id || '—'}\`\n` +
          `- **Nombre:** ${args.nombre}\n` +
          `- **Activa:** ${(args.activar_al_crear ?? true) ? 'Sí' : 'No'}`,
      }],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{
        type: 'text',
        text:
          `## ❌ No se pudo crear la automatización\n\n${msg}\n\n` +
          `Corregí el grafo y volvé a intentar desde \`automations_preview_crear_regla\`.`,
      }],
    };
  }
}

export async function handleAutomationsPreviewActivarDesactivar(args: Record<string, unknown>) {
  return {
    content: [{
      type: 'text',
      text:
        `## Preview — ${args.activar ? 'Activar' : 'Desactivar'} automatización\n\n` +
        `- **Regla ID:** ${args.regla_id}\n` +
        `- **Acción:** ${args.activar ? 'Activar' : 'Desactivar'}\n\n` +
        `---\n⚠️ Para confirmar, usar \`automations_confirmar_activar_desactivar\` con los mismos parámetros.`,
    }],
  };
}

export async function handleAutomationsConfirmarActivarDesactivar(args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>(`/api/semilla/automations/${args.regla_id}`);
  const regla = unwrap<Record<string, any>>(result);

  const estadoActual = Boolean(regla?.active);
  const deseado = Boolean(args.activar);

  if (estadoActual === deseado) {
    return {
      content: [{
        type: 'text',
        text: `La regla \`${args.regla_id}\` ya estaba ${deseado ? 'activa' : 'inactiva'}. No se hizo ningún cambio.`,
      }],
    };
  }

  await client.patch<unknown>(`/api/semilla/automations/${args.regla_id}/toggle`, {});

  return {
    content: [{
      type: 'text',
      text: `## ✅ Regla ${deseado ? 'activada' : 'desactivada'}\n\n- **Regla ID:** \`${args.regla_id}\``,
    }],
  };
}
