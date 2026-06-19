/**
 * Tools de Gastronomía para Semilla MCP.
 * Endpoints: /api/semilla/gastronomy
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, unwrap, unwrapArray } from '../client.js';

export const gastronomyTools: Tool[] = [
  {
    name: 'gastro_get_dashboard',
    description: 'Resumen del módulo Gastronomía: mesas ocupadas, ventas del día, tickets abiertos, top platos.',
    annotations: { title: 'Dashboard de Gastronomía', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'gastro_get_mesas',
    description:
      'Lista todas las mesas con su estado en vivo (libre, ocupada, esperando cuenta, sucia). ' +
      'Incluye número de mesa, salón y total acumulado si está abierta.',
    annotations: { title: 'Estado de mesas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        salon_id: { type: 'string', description: 'Filtrar por salón (opcional)' },
        estado: {
          type: 'string',
          enum: ['todas', 'libre', 'ocupada', 'esperando_cuenta', 'sucia'],
          description: 'Filtrar por estado (default: todas)',
          default: 'todas',
        },
      },
      required: [],
    },
  },
  {
    name: 'gastro_listar_platos',
    description:
      'Lista los platos del menú con su sección, precio y disponibilidad. ' +
      'Útil para responder "¿qué platos tenemos?" o "¿está disponible el pollo al verdeo?".',
    annotations: { title: 'Listar platos del menú', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        seccion: { type: 'string', description: 'Filtrar por sección del menú (entrada, principal, etc.)' },
        solo_disponibles: { type: 'boolean', description: 'Mostrar sólo los platos disponibles', default: false },
        limit: { type: 'number', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'gastro_set_plato_disponibilidad',
    description: 'Marca un plato como disponible o agotado en el menú.',
    annotations: { title: 'Disponibilidad de plato', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        variant_id: { type: 'string', description: 'UUID de la variante de producto del plato' },
        disponible: { type: 'boolean', description: 'true = disponible, false = agotado' },
      },
      required: ['variant_id', 'disponible'],
    },
  },
  {
    name: 'gastro_abrir_mesa',
    description:
      'Abre una mesa: crea una nueva sesión de mesa lista para recibir items. ' +
      'Devuelve el `session_id` que después se usa para agregar items y cobrar.',
    annotations: { title: 'Abrir mesa', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        mesa_id: { type: 'string', description: 'UUID de la mesa a abrir' },
        comensales: { type: 'number', description: 'Cantidad de comensales (opcional)' },
        mozo_id: { type: 'string', description: 'UUID del mozo asignado (opcional)' },
      },
      required: ['mesa_id'],
    },
  },
  {
    name: 'gastro_get_sesion_mesa',
    description: 'Detalle completo de una sesión de mesa abierta: líneas pedidas, subtotales y estado.',
    annotations: { title: 'Detalle de sesión de mesa', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID de la sesión de mesa' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'gastro_agregar_item_mesa',
    description:
      'Agrega un item (plato o bebida) a una mesa abierta. ' +
      'Si el plato tiene modificadores (ej: cocción, agregados), se pasan en `modificadores`.',
    annotations: { title: 'Agregar item a la mesa', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID de la sesión de mesa' },
        variant_id: { type: 'string', description: 'UUID de la variante de plato' },
        cantidad: { type: 'number', default: 1 },
        modificadores: {
          type: 'array',
          description: 'Lista de modificadores aplicados (opcional)',
          items: {
            type: 'object',
            properties: {
              modifier_id: { type: 'string' },
              cantidad: { type: 'number', default: 1 },
            },
            required: ['modifier_id'],
          },
        },
        notas: { type: 'string', description: 'Notas para cocina (ej: sin sal, bien cocido)' },
      },
      required: ['session_id', 'variant_id'],
    },
  },
  {
    name: 'gastro_pedir_cuenta',
    description: 'Marca la mesa como "esperando cuenta": cocina ya no acepta más items y la mesa pasa a estado de cobro.',
    annotations: { title: 'Pedir la cuenta', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID de la sesión de mesa' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'gastro_preview_pagar_mesa',
    description:
      'PASO 1: Previsualiza el cobro de una mesa antes de ejecutarlo. ' +
      'Muestra subtotal, propina (si corresponde), descuento y total. ' +
      'Después usar `gastro_confirmar_pagar_mesa`.',
    annotations: { title: 'Vista previa: cobrar mesa', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID de la sesión de mesa' },
        metodo_pago: {
          type: 'string',
          enum: ['efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'mixto'],
          default: 'efectivo',
        },
        propina_porcentaje: { type: 'number', description: 'Propina como % (ej: 10 para 10%)', default: 0 },
        descuento: { type: 'number', description: 'Descuento absoluto en pesos', default: 0 },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'gastro_confirmar_pagar_mesa',
    description:
      'PASO 2: Cobra y cierra la mesa efectivamente. ' +
      'Usar SOLO después de `gastro_preview_pagar_mesa` y confirmación del usuario.',
    annotations: { title: 'Cobrar mesa', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID de la sesión de mesa' },
        metodo_pago: {
          type: 'string',
          enum: ['efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'mixto'],
        },
        propina: { type: 'number', description: 'Propina absoluta en pesos', default: 0 },
        descuento: { type: 'number', description: 'Descuento absoluto en pesos', default: 0 },
        emitir_factura: { type: 'boolean', description: 'Emitir factura electrónica al cierre', default: false },
      },
      required: ['session_id', 'metodo_pago'],
    },
  },
  {
    name: 'gastro_get_cocina_tickets',
    description:
      'Tickets de cocina activos: por área (cocina caliente, parrilla, barra, etc.), con tiempo desde envío.',
    annotations: { title: 'Tickets de cocina', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        area_id: { type: 'string', description: 'Filtrar por área de cocina (opcional)' },
        estado: {
          type: 'string',
          enum: ['todos', 'pendiente', 'en_preparacion', 'listo'],
          default: 'todos',
        },
      },
      required: [],
    },
  },
  {
    name: 'gastro_listar_reservas',
    description: 'Lista las reservas de mesas para una fecha (default: hoy).',
    annotations: { title: 'Listar reservas de mesas', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD (default: hoy)' },
      },
      required: [],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleGastroGetDashboard(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/gastronomy/dashboard-stats');
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## Dashboard Gastronomía\n\n` +
        '```json\n' + JSON.stringify(data, null, 2) + '\n```',
    }],
  };
}

export async function handleGastroGetMesas(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string> = {};
  if (args.salon_id) params.room_id = String(args.salon_id);
  if (args.estado && args.estado !== 'todas') params.status = String(args.estado);

  const result = await client.get<unknown>('/api/semilla/gastronomy/tables/live', params);
  const mesas = unwrapArray(result);

  if (!mesas.length) {
    return { content: [{ type: 'text', text: 'No hay mesas que coincidan con el filtro.' }] };
  }

  const rows = mesas.map((m) =>
    `- **Mesa ${m.number || m.name || m.id}** | ${m.room_name || m.salon || '—'} | ` +
    `${m.status || '—'}` +
    (m.current_total ? ` | Total: ${formatCurrency(Number(m.current_total))}` : '')
  );

  return {
    content: [{
      type: 'text',
      text: `## Mesas (${mesas.length})\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleGastroListarPlatos(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number | boolean> = {
    limit: Number(args.limit || 50),
  };
  if (args.seccion) params.section = String(args.seccion);
  if (args.solo_disponibles) params.available = true;

  const result = await client.get<unknown>('/api/semilla/gastronomy/dishes', params);
  const platos = unwrapArray(result);

  if (!platos.length) {
    return { content: [{ type: 'text', text: 'No hay platos que coincidan con el filtro.' }] };
  }

  const rows = platos.map((p) =>
    `- **${p.name}** | ${p.section_name || p.section || '—'} | ` +
    `${formatCurrency(Number(p.price || p.list_price || 0))} | ` +
    `${p.available !== false ? '✅ Disponible' : '❌ Agotado'}`
  );

  return {
    content: [{
      type: 'text',
      text: `## Platos (${platos.length})\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleGastroSetPlatoDisponibilidad(args: Record<string, unknown>) {
  const client = getClient();
  const variantId = String(args.variant_id);
  const disponible = Boolean(args.disponible);

  await client.patch(`/api/semilla/gastronomy/dishes/${encodeURIComponent(variantId)}/availability`, {
    available: disponible,
  });

  return {
    content: [{
      type: 'text',
      text: `✅ Plato ${variantId} marcado como ${disponible ? 'disponible' : 'agotado'}.`,
    }],
  };
}

export async function handleGastroAbrirMesa(args: Record<string, unknown>) {
  const client = getClient();
  const mesaId = String(args.mesa_id);
  const body: Record<string, unknown> = {};
  if (args.comensales) body.guests = args.comensales;
  if (args.mozo_id) body.waiter_id = args.mozo_id;

  const result = await client.post<unknown>(
    `/api/semilla/gastronomy/tables/${encodeURIComponent(mesaId)}/open`,
    body,
  );
  const session = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Mesa abierta\n\n` +
        `- **Mesa:** ${mesaId}\n` +
        `- **session_id:** \`${session?.id || '—'}\`\n` +
        (session?.opened_at ? `- **Abierta a las:** ${session.opened_at}\n` : '') +
        `\nUsá este \`session_id\` para agregar items con \`gastro_agregar_item_mesa\`.`,
    }],
  };
}

export async function handleGastroGetSesionMesa(args: Record<string, unknown>) {
  const client = getClient();
  const sessionId = String(args.session_id);

  const result = await client.get<unknown>(
    `/api/semilla/gastronomy/table-sessions/${encodeURIComponent(sessionId)}`,
  );
  const session = unwrap<Record<string, unknown>>(result);
  if (!session) {
    return { content: [{ type: 'text', text: `No se encontró la sesión ${sessionId}.` }] };
  }

  const lines = (session.lines || session.items || []) as Record<string, unknown>[];
  const linesText = lines.length
    ? lines.map((l) =>
        `  - ${l.product_name || l.name} × ${l.quantity || 1} = ` +
        `${formatCurrency(Number(l.subtotal || l.price_subtotal || 0))}`,
      ).join('\n')
    : '  (sin items)';

  return {
    content: [{
      type: 'text',
      text:
        `## Sesión de mesa ${sessionId}\n\n` +
        `- **Mesa:** ${session.table_name || session.table_id || '—'}\n` +
        `- **Estado:** ${session.status || '—'}\n` +
        `- **Comensales:** ${session.guests || '—'}\n` +
        `- **Total:** ${formatCurrency(Number(session.total || 0))}\n\n` +
        `**Items:**\n${linesText}`,
    }],
  };
}

export async function handleGastroAgregarItemMesa(args: Record<string, unknown>) {
  const client = getClient();
  const sessionId = String(args.session_id);
  const body: Record<string, unknown> = {
    variant_id: args.variant_id,
    quantity: args.cantidad || 1,
  };
  if (args.modificadores) body.modifiers = args.modificadores;
  if (args.notas) body.notes = args.notas;

  const result = await client.post<unknown>(
    `/api/semilla/gastronomy/table-sessions/${encodeURIComponent(sessionId)}/items`,
    body,
  );
  const line = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Item agregado\n\n` +
        `- **Plato:** ${line?.product_name || args.variant_id}\n` +
        `- **Cantidad:** ${args.cantidad || 1}\n` +
        `- **Subtotal:** ${formatCurrency(Number(line?.subtotal || 0))}`,
    }],
  };
}

export async function handleGastroPedirCuenta(args: Record<string, unknown>) {
  const client = getClient();
  const sessionId = String(args.session_id);

  await client.post<unknown>(
    `/api/semilla/gastronomy/table-sessions/${encodeURIComponent(sessionId)}/request-bill`,
    {},
  );

  return {
    content: [{
      type: 'text',
      text: `✅ Mesa marcada como "esperando cuenta". Cocina ya no acepta más items.`,
    }],
  };
}

export async function handleGastroPreviewPagarMesa(args: Record<string, unknown>) {
  const client = getClient();
  const sessionId = String(args.session_id);
  const result = await client.get<unknown>(
    `/api/semilla/gastronomy/table-sessions/${encodeURIComponent(sessionId)}`,
  );
  const session = unwrap<Record<string, unknown>>(result);
  const subtotal = Number(session?.total || 0);
  const propinaPct = Number(args.propina_porcentaje || 0);
  const descuento = Number(args.descuento || 0);
  const propina = subtotal * (propinaPct / 100);
  const total = subtotal + propina - descuento;

  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Cobrar mesa ${session?.table_name || sessionId}\n\n` +
        `| Concepto | Importe |\n|---|---|\n` +
        `| Subtotal | ${formatCurrency(subtotal)} |\n` +
        `| Propina (${propinaPct}%) | ${formatCurrency(propina)} |\n` +
        `| Descuento | -${formatCurrency(descuento)} |\n` +
        `| **Total** | **${formatCurrency(total)}** |\n\n` +
        `Método de pago: **${args.metodo_pago || 'efectivo'}**\n\n` +
        `---\n⚠️ Para cobrar y cerrar la mesa, usar \`gastro_confirmar_pagar_mesa\`.`,
    }],
  };
}

export async function handleGastroConfirmarPagarMesa(args: Record<string, unknown>) {
  const client = getClient();
  const sessionId = String(args.session_id);
  const body: Record<string, unknown> = {
    payment_method: args.metodo_pago,
    tip: args.propina || 0,
    discount: args.descuento || 0,
    emit_invoice: Boolean(args.emitir_factura),
  };
  const result = await client.post<unknown>(
    `/api/semilla/gastronomy/table-sessions/${encodeURIComponent(sessionId)}/pay`,
    body,
  );
  const data = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Mesa cobrada y cerrada\n\n` +
        `- **Total cobrado:** ${formatCurrency(Number(data?.total || 0))}\n` +
        `- **Método:** ${args.metodo_pago}\n` +
        (data?.invoice_id ? `- **Factura:** ${data.invoice_id}\n` : '') +
        `- **Sesión cerrada:** ${sessionId}`,
    }],
  };
}

export async function handleGastroGetCocinaTickets(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string> = {};
  if (args.area_id) params.area_id = String(args.area_id);
  if (args.estado && args.estado !== 'todos') params.status = String(args.estado);

  const result = await client.get<unknown>('/api/semilla/gastronomy/kitchen/tickets', params);
  const tickets = unwrapArray(result);

  if (!tickets.length) {
    return { content: [{ type: 'text', text: 'No hay tickets activos en cocina.' }] };
  }

  const rows = tickets.map((t) =>
    `- **${t.area_name || 'Cocina'}** | Mesa ${t.table_name || t.table_id || '—'} | ` +
    `${t.product_name || '—'} × ${t.quantity || 1} | ${t.status || '—'}` +
    (t.minutes_since_sent ? ` | hace ${t.minutes_since_sent} min` : '')
  );

  return {
    content: [{
      type: 'text',
      text: `## Tickets de cocina (${tickets.length})\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleGastroListarReservas(args: Record<string, unknown>) {
  const client = getClient();
  const fecha = args.fecha ? String(args.fecha) : new Date().toISOString().split('T')[0];

  const result = await client.get<unknown>('/api/semilla/gastronomy/reservations', { date: fecha });
  const reservas = unwrapArray(result);

  if (!reservas.length) {
    return { content: [{ type: 'text', text: `No hay reservas para el ${fecha}.` }] };
  }

  const rows = reservas.map((r) =>
    `- **${r.time || r.reservation_time || '—'}** | ${r.guest_name || r.partner_name || '—'} | ` +
    `${r.guests || '—'} pers. | Mesa ${r.table_name || '—'} | ${r.status || '—'}`
  );

  return {
    content: [{
      type: 'text',
      text: `## Reservas — ${fecha} (${reservas.length})\n\n${rows.join('\n')}`,
    }],
  };
}
