/**
 * Tools de Agricultura para Semilla MCP.
 * Endpoints: /api/semilla/agriculture
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatDate, unwrap, unwrapArray } from '../client.js';

export const agricultureTools: Tool[] = [
  {
    name: 'agro_get_dashboard',
    description: 'Resumen del módulo Agricultura: especies, cultivares, lotes activos, DAVs vigentes.',
    annotations: { title: 'Dashboard de Agricultura', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agro_get_lotes_fefo',
    description:
      'Lista lotes de un producto ordenados por FEFO (First Expired First Out): ' +
      'prioriza salida según germinación o vencimiento.',
    annotations: { title: 'Lotes por FEFO', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: { type: 'string', description: 'UUID del producto/cultivar' },
      },
      required: ['producto_id'],
    },
  },
  {
    name: 'agro_get_genealogia_lote',
    description: 'Árbol genealógico completo de un lote (padres, hijos, lotes derivados).',
    annotations: { title: 'Genealogía del lote', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        lote_id: { type: 'string', description: 'UUID del lote' },
      },
      required: ['lote_id'],
    },
  },
  {
    name: 'agro_calcular_resultado_analisis',
    description:
      'Compara el resultado de un análisis de laboratorio contra el estándar INASE del cultivar. ' +
      'Devuelve si pasa o no, con detalle por parámetro.',
    annotations: { title: 'Calcular resultado de análisis', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        analisis_id: { type: 'string', description: 'UUID del análisis' },
      },
      required: ['analisis_id'],
    },
  },
  {
    name: 'agro_preview_emitir_dav',
    description:
      'PASO 1: Previsualiza la emisión de un DAV (Documento de Autorización de Venta). ' +
      'Después usar `agro_confirmar_emitir_dav`.',
    annotations: { title: 'Vista previa: emitir DAV', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        dav_id: { type: 'string', description: 'UUID del DAV en estado borrador' },
      },
      required: ['dav_id'],
    },
  },
  {
    name: 'agro_confirmar_emitir_dav',
    description:
      'PASO 2: Emite el DAV: pasa de borrador a emitido (validez 2 años). ' +
      'Acción no reversible — confirmar siempre antes de ejecutar.',
    annotations: { title: 'Emitir DAV', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        dav_id: { type: 'string', description: 'UUID del DAV' },
      },
      required: ['dav_id'],
    },
  },
  {
    name: 'agro_recalcular_regalias',
    description: 'Recalcula las regalías para un período (formato YYYY-MM).',
    annotations: { title: 'Recalcular regalías', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        periodo: { type: 'string', description: 'Período YYYY-MM' },
      },
      required: ['periodo'],
    },
  },
  {
    name: 'agro_get_stock_por_propietario',
    description: 'Stock segregado por propietario (criadero / semillero / multiplicador): KG total y N° de lotes por dueño.',
    annotations: { title: 'Stock por propietario', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        propietario_id: { type: 'string', description: 'UUID del propietario (opcional — sin filtro devuelve todos)' },
      },
      required: [],
    },
  },
  {
    name: 'agro_get_cruzamientos',
    description: 'Lista cruzamientos del programa de mejoramiento. Filtros opcionales por especie, estado y generación.',
    annotations: { title: 'Listar cruzamientos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        especie_id: { type: 'string', description: 'UUID de la especie' },
        estado: { type: 'string', description: 'planificado | realizado | evaluacion | descartado | seleccionado' },
        generacion: { type: 'string', description: 'F1 | F2 | … | RC2' },
      },
      required: [],
    },
  },
  {
    name: 'agro_get_cruzamiento_genealogia',
    description: 'Genealogía de un cruzamiento: parentales (♀ y ♂) y progenies derivadas.',
    annotations: { title: 'Genealogía del cruzamiento', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        cruzamiento_id: { type: 'string', description: 'UUID del cruzamiento' },
      },
      required: ['cruzamiento_id'],
    },
  },
  {
    name: 'agro_get_ensayos',
    description: 'Lista ensayos agronómicos. Filtros opcionales por temporada y estado.',
    annotations: { title: 'Listar ensayos', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        temporada: { type: 'string' },
        estado: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'agro_get_ensayo_resumen',
    description: 'Resumen agregado de un ensayo: medias y desvíos por línea × variable.',
    annotations: { title: 'Resumen de ensayo', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        ensayo_id: { type: 'string', description: 'UUID del ensayo' },
      },
      required: ['ensayo_id'],
    },
  },
  {
    name: 'agro_get_labores_parcela',
    description: 'Labores culturales realizadas en una parcela, cronológicas, con costo acumulado.',
    annotations: { title: 'Labores de la parcela', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela' },
      },
      required: ['parcela_id'],
    },
  },
  {
    name: 'agro_registrar_labor_cultural',
    description: 'Registra una labor cultural (siembra, fertilización, fitosanitario, riego, cosecha, etc.) sobre una parcela.',
    annotations: { title: 'Registrar labor cultural', destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela' },
        tipo: { type: 'string', description: 'siembra | refertilizacion | fertilizacion_base | aplicacion_fitosanitaria | control_maleza | riego | desmalezado_manual | cosecha | monitoreo' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        producto_id: { type: 'string', description: 'UUID del insumo (opcional)' },
        dosis: { type: 'number' },
        dosis_unidad: { type: 'string', description: 'ej: l/ha, kg/ha' },
        superficie_ha: { type: 'number' },
        costo: { type: 'number' },
        observaciones: { type: 'string' },
      },
      required: ['tipo', 'fecha'],
    },
  },
  {
    name: 'agro_get_libreta_timeline',
    description: 'Timeline de la libreta de campo, filtrable por parcela, ensayo o campo.',
    annotations: { title: 'Timeline de libreta de campo', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string' },
        ensayo_sitio_id: { type: 'string' },
        campo_id: { type: 'string' },
        limit: { type: 'number', description: 'Default 100, máximo 500' },
      },
      required: [],
    },
  },
  {
    name: 'agro_registrar_entrada_libreta',
    description:
      'Registra una entrada en la libreta de campo (observación, medición, sanidad, clima, nota). ' +
      'Si se pasan lat/lng, queda geolocalizada (aparece como pin de scouting en el mapa).',
    annotations: { title: 'Registrar entrada de libreta', destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        tipo_entrada: { type: 'string', description: 'observacion | medicion | incidencia_sanitaria | clima | nota' },
        texto: { type: 'string' },
        parcela_id: { type: 'string' },
        ensayo_sitio_id: { type: 'string' },
        campo_id: { type: 'string' },
        lat: { type: 'number', description: 'Latitud (scouting, opcional)' },
        lng: { type: 'number', description: 'Longitud (scouting, opcional)' },
      },
      required: ['fecha', 'texto'],
    },
  },
  // ─── Modo Campo (productor) ───────────────────────────────────────────────
  {
    name: 'agro_get_campos_operativos',
    description:
      'Vista operativa del Modo Campo: campos activos con sus parcelas agregadas ' +
      '(estado, cultivar, superficie y % de avance del ciclo). Filtro opcional por temporada.',
    annotations: { title: 'Campos operativos (Modo Campo)', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        temporada: { type: 'string', description: 'Ej: 2025/26 (opcional)' },
      },
      required: [],
    },
  },
  {
    name: 'agro_get_parcela_timeline',
    description:
      'Historial cronológico de una parcela: combina entradas de libreta, labores e ' +
      'inspecciones en una sola lista, junto con los datos de la parcela.',
    annotations: { title: 'Historial de la parcela', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela' },
      },
      required: ['parcela_id'],
    },
  },
  {
    name: 'agro_declarar_parcela',
    description:
      'Declara la siembra de una parcela (borrador → declarada). Opcionalmente guarda el ' +
      'payload de la DJ de siembra para INASE.',
    annotations: { title: 'Declarar siembra de parcela', destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela en estado borrador' },
        dj_siembra_payload: { type: 'object', description: 'Payload de la DJ de siembra (opcional)' },
      },
      required: ['parcela_id'],
    },
  },
  {
    name: 'agro_registrar_cosecha',
    description:
      'Registra la cosecha de una parcela: kg cosechados, merma (%) y fecha; la pasa a estado ' +
      '"cosechada" y devuelve el rendimiento estimado en kg/ha.',
    annotations: { title: 'Registrar cosecha', destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela' },
        kg_cosechados: { type: 'number', description: 'Kilos cosechados' },
        merma_pct: { type: 'number', description: 'Merma en % (opcional)' },
        fecha_cosecha: { type: 'string', description: 'YYYY-MM-DD (opcional; default hoy)' },
      },
      required: ['parcela_id', 'kg_cosechados'],
    },
  },
  // ─── Mostrador / Despacho (comercializador) ───────────────────────────────
  {
    name: 'agro_get_fenologia',
    description:
      'Fenología estimada de una parcela: estadio de crecimiento (escala BBCH) según los ' +
      'grados-día acumulados desde la siembra. Requiere fecha_siembra en la parcela y que su ' +
      'campo esté geolocalizado.',
    annotations: { title: 'Fenología de la parcela', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        parcela_id: { type: 'string', description: 'UUID de la parcela' },
        tbase: { type: 'number', description: 'Temperatura base para grados-día (default 10°C)' },
      },
      required: ['parcela_id'],
    },
  },
  {
    name: 'agro_get_clima_campo',
    description:
      'Clima en tiempo real de un campo geolocalizado: actual + pronóstico 7 días + ' +
      'métricas agro acumuladas (lluvia 7/30 días, grados-día GDD, ET0 y balance hídrico). ' +
      'Fuente Open-Meteo. Requiere que el campo tenga ubicación cargada.',
    annotations: { title: 'Clima del campo', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        campo_id: { type: 'string', description: 'UUID del campo' },
        tbase: { type: 'number', description: 'Temperatura base para grados-día (default 10°C)' },
      },
      required: ['campo_id'],
    },
  },
  {
    name: 'agro_set_campo_ubicacion',
    description:
      'Geolocaliza un campo: guarda lat/lng como GeoJSON Point en campos.geojson. ' +
      'Habilita que el campo aparezca en el Mapa del Modo Campo.',
    annotations: { title: 'Geolocalizar campo', destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        campo_id: { type: 'string', description: 'UUID del campo' },
        lat: { type: 'number', description: 'Latitud (-90 a 90)' },
        lng: { type: 'number', description: 'Longitud (-180 a 180)' },
      },
      required: ['campo_id', 'lat', 'lng'],
    },
  },
  {
    name: 'agro_lotes_vendibles',
    description:
      'Lista los lotes de semilla VENDIBLES: stock certificado con DAV vigente (emitido y no ' +
      'vencido) y cantidad disponible, ordenados por FEFO. Incluye producto, germinación y datos del DAV.',
    annotations: { title: 'Lotes vendibles', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agro_venta_despacho',
    description:
      'Despacha semilla: valida que cada lote tenga DAV vigente y stock suficiente, y descuenta ' +
      'los kg del lote certificado. NO crea la orden de venta (eso va por el módulo de ventas). ' +
      'Atómico: si una línea falla la validación, no se descuenta nada.',
    annotations: { title: 'Despachar semilla', destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          description: 'Líneas a despachar',
          items: {
            type: 'object',
            properties: {
              lote_id: { type: 'string', description: 'UUID del stock_lot' },
              kg: { type: 'number', description: 'Kilos a despachar' },
            },
            required: ['lote_id', 'kg'],
          },
        },
        sale_order_id: { type: 'string', description: 'UUID de la orden de venta asociada (opcional)' },
      },
      required: ['lines'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleAgroGetDashboard(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/agriculture/dashboard-stats');
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{
      type: 'text',
      text: `## Dashboard Agricultura\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleAgroGetLotesFefo(args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/agriculture/lotes/fefo', {
    producto_id: String(args.producto_id),
  });
  const lotes = unwrapArray(result);

  if (!lotes.length) {
    return { content: [{ type: 'text', text: 'No hay lotes disponibles para ese producto.' }] };
  }

  const rows = lotes.map((l, i) =>
    `${i + 1}. **${l.numero || l.code || l.id}** | ` +
    `Stock: ${l.stock || l.quantity || 0} | ` +
    `Germinación: ${l.germinacion || '—'}% | ` +
    `Vence: ${formatDate(String(l.fecha_vencimiento || ''))}`
  );

  return {
    content: [{
      type: 'text',
      text: `## Lotes FEFO (${lotes.length})\n\nOrden de salida sugerido:\n\n${rows.join('\n')}`,
    }],
  };
}

export async function handleAgroGetGenealogiaLote(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.lote_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/lotes/${encodeURIComponent(id)}/genealogia`);
  const data = unwrap<unknown>(result);

  return {
    content: [{
      type: 'text',
      text: `## Genealogía del lote ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleAgroCalcularResultadoAnalisis(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.analisis_id);
  const result = await client.post<unknown>(
    `/api/semilla/agriculture/analisis/${encodeURIComponent(id)}/calcular-resultado`,
    {},
  );
  const data = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Resultado del análisis ${id}\n\n` +
        `- **Resultado global:** ${data?.passes ? '✅ PASA' : '❌ NO PASA'}\n\n` +
        `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleAgroPreviewEmitirDav(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.dav_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/davs/${encodeURIComponent(id)}`);
  const dav = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Preview — Emitir DAV\n\n` +
        `- **ID:** ${id}\n` +
        `- **Estado actual:** ${dav?.state || '—'}\n` +
        (dav?.lote_numero ? `- **Lote:** ${dav.lote_numero}\n` : '') +
        (dav?.cantidad ? `- **Cantidad:** ${dav.cantidad}\n` : '') +
        `\nAl emitirlo:\n` +
        `- Pasa de borrador a emitido\n` +
        `- Genera la validez de 2 años\n` +
        `- **Acción no reversible**\n\n` +
        `---\n⚠️ Para emitir, usar \`agro_confirmar_emitir_dav\`.`,
    }],
  };
}

export async function handleAgroConfirmarEmitirDav(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.dav_id);
  const result = await client.post<unknown>(
    `/api/semilla/agriculture/davs/${encodeURIComponent(id)}/emitir`,
    {},
  );
  const dav = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ DAV emitido\n\n` +
        `- **ID:** ${id}\n` +
        `- **Nuevo estado:** ${dav?.state || 'emitido'}\n` +
        (dav?.fecha_emision ? `- **Fecha emisión:** ${formatDate(String(dav.fecha_emision))}\n` : '') +
        (dav?.fecha_vencimiento ? `- **Vence:** ${formatDate(String(dav.fecha_vencimiento))}\n` : ''),
    }],
  };
}

export async function handleAgroRecalcularRegalias(args: Record<string, unknown>) {
  const client = getClient();
  const periodo = String(args.periodo);
  const result = await client.post<unknown>('/api/semilla/agriculture/regalias/recalcular', { periodo });
  const data = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Regalías recalculadas\n\n` +
        `- **Período:** ${periodo}\n` +
        `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
    }],
  };
}

export async function handleAgroGetStockPorPropietario(args: Record<string, unknown>) {
  const client = getClient();
  const propietarioId = args.propietario_id ? String(args.propietario_id) : '';
  const qs = propietarioId ? `?propietario_id=${encodeURIComponent(propietarioId)}` : '';
  const result = await client.get<unknown>(`/api/semilla/agriculture/stock-por-propietario${qs}`);
  const data = unwrap<unknown>(result);
  return {
    content: [{ type: 'text', text: `## Stock por propietario\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetCruzamientos(args: Record<string, unknown>) {
  const client = getClient();
  const params = new URLSearchParams();
  if (args.especie_id) params.set('especie_id', String(args.especie_id));
  if (args.estado) params.set('estado', String(args.estado));
  if (args.generacion) params.set('generacion', String(args.generacion));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/generic/cruzamientos${qs}`);
  const data = unwrapArray<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## Cruzamientos (${data.length})\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetCruzamientoGenealogia(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.cruzamiento_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/cruzamientos/${encodeURIComponent(id)}/genealogia`);
  const data = unwrap<unknown>(result);
  return {
    content: [{ type: 'text', text: `## Genealogía cruzamiento ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetEnsayos(args: Record<string, unknown>) {
  const client = getClient();
  const params = new URLSearchParams();
  if (args.temporada) params.set('temporada', String(args.temporada));
  if (args.estado) params.set('estado', String(args.estado));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/generic/ensayos${qs}`);
  const data = unwrapArray<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## Ensayos (${data.length})\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetEnsayoResumen(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.ensayo_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/ensayos/${encodeURIComponent(id)}/resumen`);
  const data = unwrap<unknown>(result);
  return {
    content: [{ type: 'text', text: `## Resumen ensayo ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetLaboresParcela(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.parcela_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/parcelas/${encodeURIComponent(id)}/labores`);
  const data = unwrap<unknown>(result);
  return {
    content: [{ type: 'text', text: `## Labores de parcela ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroRegistrarLaborCultural(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    tipo: args.tipo,
    fecha: args.fecha,
  };
  if (args.parcela_id) body.parcela_id = args.parcela_id;
  if (args.producto_id) body.producto_id = args.producto_id;
  if (args.dosis !== undefined) body.dosis = args.dosis;
  if (args.dosis_unidad) body.dosis_unidad = args.dosis_unidad;
  if (args.superficie_ha !== undefined) body.superficie_ha = args.superficie_ha;
  if (args.costo !== undefined) body.costo = args.costo;
  if (args.observaciones) body.observaciones = args.observaciones;
  const result = await client.post<unknown>('/api/semilla/generic/labores_culturales', body);
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## ✅ Labor cultural registrada\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetLibretaTimeline(args: Record<string, unknown>) {
  const client = getClient();
  const params = new URLSearchParams();
  if (args.parcela_id) params.set('parcela_id', String(args.parcela_id));
  if (args.ensayo_sitio_id) params.set('ensayo_sitio_id', String(args.ensayo_sitio_id));
  if (args.campo_id) params.set('campo_id', String(args.campo_id));
  if (args.limit) params.set('limit', String(args.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/agriculture/libreta-campo/timeline${qs}`);
  const data = unwrap<unknown>(result);
  return {
    content: [{ type: 'text', text: `## Timeline libreta de campo\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroRegistrarEntradaLibreta(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = {
    fecha: args.fecha,
    texto: args.texto,
    tipo_entrada: args.tipo_entrada || 'observacion',
  };
  if (args.parcela_id) body.parcela_id = args.parcela_id;
  if (args.ensayo_sitio_id) body.ensayo_sitio_id = args.ensayo_sitio_id;
  if (args.campo_id) body.campo_id = args.campo_id;
  if (args.lat !== undefined && args.lng !== undefined) {
    body.geojson = { type: 'Feature', geometry: { type: 'Point', coordinates: [args.lng, args.lat] }, properties: {} };
  }
  const result = await client.post<unknown>('/api/semilla/generic/libreta_campo_entradas', body);
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## ✅ Entrada de libreta registrada\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroGetCamposOperativos(args: Record<string, unknown>) {
  const client = getClient();
  const params = new URLSearchParams();
  if (args.temporada) params.set('temporada', String(args.temporada));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/agriculture/fullscreen/campos${qs}`);
  const campos = unwrapArray<Record<string, any>>(result);

  if (!campos.length) {
    return { content: [{ type: 'text', text: 'No hay campos activos cargados.' }] };
  }

  const blocks = campos.map((c) => {
    const parcelas = (c.parcelas as any[]) || [];
    const rows = parcelas.length
      ? parcelas.map((p) =>
          `   - **${p.nombre}** · ${p.cultivar_nombre || 'sin cultivar'} · ` +
          `${p.superficie_ha ?? '—'} ha · ${p.estado} (${p.avance_pct ?? 0}%)`,
        ).join('\n')
      : '   _(sin parcelas)_';
    return `### ${c.nombre}${c.localidad ? ` — ${c.localidad}` : ''} (${parcelas.length} parcelas)\n${rows}`;
  });

  return {
    content: [{ type: 'text', text: `## Modo Campo — ${campos.length} campos\n\n${blocks.join('\n\n')}` }],
  };
}

export async function handleAgroGetParcelaTimeline(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.parcela_id);
  const result = await client.get<unknown>(`/api/semilla/agriculture/parcelas/${encodeURIComponent(id)}/timeline`);
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## Historial de la parcela ${id}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroDeclararParcela(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.parcela_id);
  const body: Record<string, unknown> = {};
  if (args.dj_siembra_payload) body.dj_siembra_payload = args.dj_siembra_payload;
  const result = await client.post<unknown>(
    `/api/semilla/agriculture/parcelas/${encodeURIComponent(id)}/declarar`,
    body,
  );
  const data = unwrap<Record<string, unknown>>(result);
  return {
    content: [{ type: 'text', text: `## ✅ Parcela declarada\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
  };
}

export async function handleAgroRegistrarCosecha(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.parcela_id);
  const body: Record<string, unknown> = { kg_cosechados: args.kg_cosechados };
  if (args.merma_pct !== undefined) body.merma_pct = args.merma_pct;
  if (args.fecha_cosecha) body.fecha_cosecha = args.fecha_cosecha;
  const result = await client.post<unknown>(
    `/api/semilla/agriculture/parcelas/${encodeURIComponent(id)}/cosechar`,
    body,
  );
  const data = unwrap<Record<string, any>>(result);
  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Cosecha registrada\n\n` +
        `- **Parcela:** ${data?.nombre || id}\n` +
        `- **Kg cosechados:** ${data?.kg_cosechados ?? args.kg_cosechados}\n` +
        (data?.merma_pct != null ? `- **Merma:** ${data.merma_pct}%\n` : '') +
        (data?.rendimiento_kg_ha != null ? `- **Rendimiento:** ${data.rendimiento_kg_ha} kg/ha\n` : '') +
        `- **Estado:** ${data?.estado || 'cosechada'}`,
    }],
  };
}

export async function handleAgroGetFenologia(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.parcela_id);
  const params = new URLSearchParams();
  if (args.tbase !== undefined) params.set('tbase', String(args.tbase));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/agriculture/parcelas/${encodeURIComponent(id)}/fenologia${qs}`);
  const d = unwrap<Record<string, any>>(result);
  const ea = d?.etapa_actual || {};
  const px = d?.proxima_etapa;
  return {
    content: [{
      type: 'text',
      text:
        `## Fenología — ${d?.nombre || id}\n\n` +
        `- **Etapa actual:** ${ea.nombre || '—'} (BBCH ${ea.bbch || '—'})\n` +
        `- **Días desde siembra:** ${d?.dias_desde_siembra ?? '—'} · **GDD acumulado:** ${d?.gdd_acumulado ?? '—'} (base ${d?.tbase ?? 10}°)\n` +
        (px ? `- **Próxima etapa:** ${px.nombre} (BBCH ${px.bbch}) — ${d?.progreso_pct ?? 0}% de avance\n` : '- En etapa final\n'),
    }],
  };
}

export async function handleAgroGetClimaCampo(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.campo_id);
  const params = new URLSearchParams();
  if (args.tbase !== undefined) params.set('tbase', String(args.tbase));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await client.get<unknown>(`/api/semilla/agriculture/campos/${encodeURIComponent(id)}/clima${qs}`);
  const data = unwrap<Record<string, any>>(result);
  const a = data?.actual || {};
  const ac = data?.acumulados || {};
  const pron = (data?.pronostico as any[]) || [];
  const pronRows = pron.map((d) =>
    `- ${d.fecha}: ${d.descripcion}, ${d.t_min ?? '—'}°/${d.t_max ?? '—'}°` +
    (d.lluvia_mm ? `, lluvia ${d.lluvia_mm}mm` : ''),
  );
  return {
    content: [{
      type: 'text',
      text:
        `## Clima — ${data?.nombre || id}\n\n` +
        `**Ahora:** ${a.descripcion || '—'}, ${a.temperatura ?? '—'}°C · humedad ${a.humedad ?? '—'}% · viento ${a.viento ?? '—'} km/h\n\n` +
        `**Acumulados (30 días):** lluvia ${ac.lluvia_30d ?? '—'}mm (7d ${ac.lluvia_7d ?? '—'}mm) · ` +
        `GDD ${ac.gdd_30d ?? '—'} (base ${ac.tbase ?? 10}°) · ET0 ${ac.et0_30d ?? '—'}mm · ` +
        `balance hídrico ${ac.balance_hidrico_30d ?? '—'}mm\n\n` +
        `**Pronóstico:**\n${pronRows.join('\n') || '—'}`,
    }],
  };
}

export async function handleAgroSetCampoUbicacion(args: Record<string, unknown>) {
  const client = getClient();
  const id = String(args.campo_id);
  const result = await client.post<unknown>(
    `/api/semilla/agriculture/campos/${encodeURIComponent(id)}/ubicacion`,
    { lat: args.lat, lng: args.lng },
  );
  const data = unwrap<Record<string, any>>(result);
  return {
    content: [{ type: 'text', text: `## ✅ Campo geolocalizado\n\n- **Campo:** ${data?.nombre || id}\n- **Lat/Lng:** ${args.lat}, ${args.lng}` }],
  };
}

export async function handleAgroLotesVendibles(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/agriculture/lotes/vendibles');
  const lotes = unwrapArray<Record<string, any>>(result);

  if (!lotes.length) {
    return { content: [{ type: 'text', text: 'No hay lotes vendibles (con DAV vigente y stock).' }] };
  }

  const rows = lotes.map((l, i) =>
    `${i + 1}. **Lote ${l.numero_lote}** · ${l.producto_nombre || 'semilla'} · ` +
    `${l.cantidad_actual} kg disp. · G ${l.germinacion ?? '—'}% · ` +
    `DAV ${l.numero_inase || l.numero_interno || '—'} vence ${formatDate(String(l.dav_vencimiento || ''))}`,
  );

  return {
    content: [{ type: 'text', text: `## Lotes vendibles (${lotes.length}) — orden FEFO\n\n${rows.join('\n')}` }],
  };
}

export async function handleAgroVentaDespacho(args: Record<string, unknown>) {
  const client = getClient();
  const body: Record<string, unknown> = { lines: args.lines };
  if (args.sale_order_id) body.sale_order_id = args.sale_order_id;
  const result = await client.post<unknown>('/api/semilla/agriculture/ventas/despacho', body);
  const data = unwrap<Record<string, any>>(result);
  const lineas = (data?.lineas as any[]) || [];
  const rows = lineas.map((l) => `- Lote ${l.numero_lote}: −${l.kg_despachados} kg (quedan ${l.cantidad_actual} kg)`);
  return {
    content: [{
      type: 'text',
      text: `## ✅ Despacho confirmado\n\n${rows.join('\n') || '(sin líneas)'}`,
    }],
  };
}
