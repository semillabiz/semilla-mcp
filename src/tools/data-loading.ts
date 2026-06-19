/**
 * Tools de carga masiva e ingesta de documentos para Semilla MCP.
 *
 * Diseñado para que Claude pueda:
 *  - Subir un PDF de factura de proveedor y cargarlo en el sistema en borrador,
 *    matcheando productos existentes automáticamente.
 *  - Actualizar productos, contactos e imágenes en lote en un solo paso.
 *
 * El parseo del PDF lo hace Claude (nativamente). Estas tools reciben los datos
 * ya estructurados y se encargan del matcheo + creación en el ERP.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, formatCurrency, formatDate } from '../client.js';

// ─── Tipos compartidos ────────────────────────────────────────────────────────

interface LineaItem {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  codigo_proveedor?: string;
  codigo_barras?: string;
  iva_porcentaje?: number;
}

interface ProductoMatch {
  linea: LineaItem;
  producto_id?: string;
  producto_nombre?: string;
  metodo_match: 'code' | 'barcode' | 'nombre' | 'sin_match';
  confianza: 'alta' | 'media' | 'baja' | 'ninguna';
  alternativas?: { id: string; name: string; code?: string }[];
}

// ─── Helpers de normalización y matcheo ───────────────────────────────────────

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizar(a).split(' ').filter((t) => t.length >= 2));
  const tb = new Set(normalizar(b).split(' ').filter((t) => t.length >= 2));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

async function buscarProductos(query: string, limit = 5): Promise<Record<string, unknown>[]> {
  const client = getClient();
  try {
    const result = await client.get<unknown>('/api/semilla/products', { search: query, limit });
    if (Array.isArray(result)) return result as Record<string, unknown>[];
    if (result && typeof result === 'object' && 'data' in result) {
      return ((result as Record<string, unknown>).data as Record<string, unknown>[]) || [];
    }
    return [];
  } catch {
    return [];
  }
}

async function matchearLinea(linea: LineaItem): Promise<ProductoMatch> {
  // 1. Match por código (SKU) — más confiable
  if (linea.codigo_proveedor) {
    const found = await buscarProductos(linea.codigo_proveedor, 5);
    const exact = found.find((p) => {
      const code = String(p.code || p.default_code || p.sku || '').toLowerCase();
      return code && code === String(linea.codigo_proveedor).toLowerCase();
    });
    if (exact) {
      return {
        linea,
        producto_id: String(exact.id),
        producto_nombre: String(exact.name || ''),
        metodo_match: 'code',
        confianza: 'alta',
      };
    }
  }

  // 2. Match por código de barras
  if (linea.codigo_barras) {
    const found = await buscarProductos(linea.codigo_barras, 5);
    const exact = found.find((p) => String(p.barcode || '').trim() === String(linea.codigo_barras).trim());
    if (exact) {
      return {
        linea,
        producto_id: String(exact.id),
        producto_nombre: String(exact.name || ''),
        metodo_match: 'barcode',
        confianza: 'alta',
      };
    }
  }

  // 3. Match por nombre normalizado
  if (linea.descripcion) {
    const found = await buscarProductos(linea.descripcion, 5);
    if (found.length) {
      const ranked = found
        .map((p) => ({ p, score: tokenOverlap(String(p.name || ''), linea.descripcion) }))
        .sort((a, b) => b.score - a.score);

      const top = ranked[0];
      if (top.score >= 0.7) {
        return {
          linea,
          producto_id: String(top.p.id),
          producto_nombre: String(top.p.name || ''),
          metodo_match: 'nombre',
          confianza: 'alta',
        };
      }
      if (top.score >= 0.4) {
        return {
          linea,
          producto_id: String(top.p.id),
          producto_nombre: String(top.p.name || ''),
          metodo_match: 'nombre',
          confianza: 'media',
          alternativas: ranked.slice(1, 4).map(({ p }) => ({
            id: String(p.id),
            name: String(p.name || ''),
            code: p.code ? String(p.code) : undefined,
          })),
        };
      }
      // Score bajo — devolver como candidato dudoso
      return {
        linea,
        metodo_match: 'sin_match',
        confianza: top.score > 0 ? 'baja' : 'ninguna',
        alternativas: ranked.slice(0, 4).map(({ p }) => ({
          id: String(p.id),
          name: String(p.name || ''),
          code: p.code ? String(p.code) : undefined,
        })),
      };
    }
  }

  return { linea, metodo_match: 'sin_match', confianza: 'ninguna' };
}

async function resolverProveedor(
  nombre?: string,
  cuit?: string
): Promise<{ id?: string; nombre?: string; encontrado: boolean; candidatos: Record<string, unknown>[] }> {
  const client = getClient();
  const candidatos: Record<string, unknown>[] = [];

  // 1. Por CUIT — el más confiable
  if (cuit) {
    try {
      const r = await client.get<unknown>('/api/semilla/partners', { search: cuit, is_supplier: true, limit: 5 });
      const list: Record<string, unknown>[] = Array.isArray(r)
        ? (r as Record<string, unknown>[])
        : ((r as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];
      const exact = list.find((p) => String(p.vat || '').replace(/\D/g, '') === String(cuit).replace(/\D/g, ''));
      if (exact) return { id: String(exact.id), nombre: String(exact.name || ''), encontrado: true, candidatos: [] };
      candidatos.push(...list);
    } catch { /* sigue al match por nombre */ }
  }

  // 2. Por nombre
  if (nombre) {
    try {
      const r = await client.get<unknown>('/api/semilla/partners', { search: nombre, is_supplier: true, limit: 5 });
      const list: Record<string, unknown>[] = Array.isArray(r)
        ? (r as Record<string, unknown>[])
        : ((r as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

      const ranked = list
        .map((p) => ({ p, score: tokenOverlap(String(p.name || ''), nombre) }))
        .sort((a, b) => b.score - a.score);

      if (ranked.length && ranked[0].score >= 0.7) {
        return {
          id: String(ranked[0].p.id),
          nombre: String(ranked[0].p.name || ''),
          encontrado: true,
          candidatos: [],
        };
      }
      candidatos.push(...ranked.map((r) => r.p));
    } catch { /* devuelve sin candidatos */ }
  }

  return { encontrado: false, candidatos };
}

// ─── Definiciones de tools ────────────────────────────────────────────────────

export const dataLoadingTools: Tool[] = [
  {
    name: 'matchear_productos_proveedor',
    description:
      'Dado un listado de ítems extraídos de una factura/remito de proveedor, busca productos ' +
      'existentes en el catálogo que correspondan a cada ítem. NO crea nada — solo muestra qué se ' +
      'matcheó y con qué confianza. Usar ANTES de `cargar_documento_proveedor` para que el ' +
      'usuario revise.',
    annotations: { title: 'Matchear productos de proveedor', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Lista de ítems a buscar en el catálogo',
          items: {
            type: 'object',
            properties: {
              descripcion: { type: 'string', description: 'Descripción del producto (como aparece en la factura)' },
              cantidad: { type: 'number', description: 'Cantidad facturada' },
              precio_unitario: { type: 'number', description: 'Precio unitario' },
              codigo_proveedor: { type: 'string', description: 'Código/SKU del producto (si figura en la factura)' },
              codigo_barras: { type: 'string', description: 'Código de barras EAN/UPC (opcional)' },
            },
            required: ['descripcion'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'cargar_documento_proveedor',
    description:
      'Carga una factura de proveedor o una orden de compra en BORRADOR a partir de los datos ' +
      'extraídos por Claude de un PDF/imagen. Resuelve el proveedor automáticamente (por CUIT o ' +
      'nombre), matchea cada línea con productos existentes del catálogo, y crea el documento ' +
      'listo para que el usuario revise/edite y postee.\n\n' +
      '**ANTES de llamar esta tool, preguntale SIEMPRE al usuario:**\n' +
      '  "¿Querés cargar esto como **factura de proveedor** o como **orden de compra**?"\n' +
      'Una factura registra la deuda contable; una orden de compra es el pedido previo a recibir ' +
      'la mercadería.\n\n' +
      'Si hay líneas sin match, devuelven una descripción libre (no se crean productos nuevos ' +
      'salvo que `auto_crear_productos: true`).',
    annotations: { title: 'Cargar documento de proveedor', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        tipo_documento: {
          type: 'string',
          enum: ['factura', 'orden_compra'],
          description: 'Tipo de documento a crear (preguntale al usuario antes).',
        },
        proveedor_nombre: { type: 'string', description: 'Razón social del proveedor' },
        proveedor_cuit: { type: 'string', description: 'CUIT del proveedor (sin guiones)' },
        proveedor_id: { type: 'string', description: 'UUID del proveedor (si ya lo tenés)' },
        numero_factura: { type: 'string', description: 'Número de comprobante del proveedor (ej "0001-00012345")' },
        fecha: { type: 'string', description: 'Fecha del comprobante (YYYY-MM-DD, default: hoy)' },
        fecha_vencimiento: { type: 'string', description: 'Vencimiento (YYYY-MM-DD, opcional)' },
        items: {
          type: 'array',
          description: 'Líneas extraídas del documento',
          items: {
            type: 'object',
            properties: {
              descripcion: { type: 'string' },
              cantidad: { type: 'number' },
              precio_unitario: { type: 'number' },
              codigo_proveedor: { type: 'string' },
              codigo_barras: { type: 'string' },
              iva_porcentaje: { type: 'number', description: 'Alicuota IVA (21, 10.5, 0)' },
            },
            required: ['descripcion', 'cantidad', 'precio_unitario'],
          },
        },
        auto_crear_proveedor: {
          type: 'boolean',
          description: 'Si no se encuentra el proveedor por CUIT/nombre, ¿crearlo? (default: false — pregunta al usuario)',
          default: false,
        },
        auto_crear_productos: {
          type: 'boolean',
          description:
            'Para líneas sin match, crear productos nuevos automáticamente (default: false — la ' +
            'línea queda como texto libre).',
          default: false,
        },
        notas: { type: 'string', description: 'Notas adicionales para el documento' },
      },
      required: ['tipo_documento', 'items'],
    },
  },
  {
    name: 'actualizar_productos_lote',
    description:
      'Actualiza varios productos en una sola operación. Útil para revisar/actualizar precios, ' +
      'SKUs, categorías o stock disponible en POS de muchos productos a la vez. ' +
      'Cada elemento debe traer `producto_id` + los campos a modificar.',
    annotations: { title: 'Actualizar productos (lote)', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        actualizaciones: {
          type: 'array',
          description: 'Lista de actualizaciones (una por producto)',
          items: {
            type: 'object',
            properties: {
              producto_id: { type: 'string' },
              nombre: { type: 'string' },
              sku: { type: 'string' },
              codigo_barras: { type: 'string' },
              precio_venta: { type: 'number' },
              precio_costo: { type: 'number' },
              categoria_id: { type: 'string' },
              activo: { type: 'boolean' },
              disponible_en_pos: { type: 'boolean' },
            },
            required: ['producto_id'],
          },
        },
      },
      required: ['actualizaciones'],
    },
  },
  {
    name: 'actualizar_contactos_lote',
    description:
      'Actualiza varios contactos (clientes/proveedores) en una sola operación. Cada elemento ' +
      'debe traer `partner_id` + los campos a modificar.',
    annotations: { title: 'Actualizar contactos (lote)', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        actualizaciones: {
          type: 'array',
          description: 'Lista de actualizaciones (una por contacto)',
          items: {
            type: 'object',
            properties: {
              partner_id: { type: 'string' },
              nombre: { type: 'string' },
              email: { type: 'string' },
              telefono: { type: 'string' },
              cuit: { type: 'string' },
              direccion: { type: 'string' },
              ciudad: { type: 'string' },
              es_cliente: { type: 'boolean' },
              es_proveedor: { type: 'boolean' },
            },
            required: ['partner_id'],
          },
        },
      },
      required: ['actualizaciones'],
    },
  },
  {
    name: 'subir_imagenes_productos_lote',
    description:
      'Sube imágenes primarias para varios productos en una sola operación. Cada elemento debe ' +
      'tener `producto_id` y `imagen_url` (URL pública desde donde descargar la imagen).',
    annotations: { title: 'Subir imágenes (lote)', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        imagenes: {
          type: 'array',
          description: 'Lista de imágenes a subir',
          items: {
            type: 'object',
            properties: {
              producto_id: { type: 'string' },
              imagen_url: { type: 'string', description: 'URL pública (jpg, png, webp, gif)' },
            },
            required: ['producto_id', 'imagen_url'],
          },
        },
      },
      required: ['imagenes'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

function renderMatch(m: ProductoMatch, index: number): string {
  const linea = m.linea;
  const cantidad = linea.cantidad ?? '?';
  const precio = linea.precio_unitario ? formatCurrency(linea.precio_unitario) : '—';
  const header = `${index + 1}. **${linea.descripcion}** × ${cantidad} @ ${precio}`;

  if (m.metodo_match === 'sin_match') {
    const altText = m.alternativas?.length
      ? `\n   Candidatos posibles:\n` +
        m.alternativas.map((a) => `     - \`${a.id}\` — ${a.name}${a.code ? ` (${a.code})` : ''}`).join('\n')
      : '';
    return `${header}\n   ❌ **Sin match** (confianza: ${m.confianza})${altText}`;
  }

  const icon = m.confianza === 'alta' ? '✅' : '⚠️';
  const tag = m.metodo_match === 'code' ? 'SKU' : m.metodo_match === 'barcode' ? 'código de barras' : 'nombre';
  const altText = m.alternativas?.length
    ? `\n   Alternativas:\n` +
      m.alternativas.map((a) => `     - \`${a.id}\` — ${a.name}${a.code ? ` (${a.code})` : ''}`).join('\n')
    : '';
  return (
    `${header}\n` +
    `   ${icon} ${m.producto_nombre} (\`${m.producto_id}\`) — match por ${tag}, confianza ${m.confianza}${altText}`
  );
}

export async function handleMatchearProductosProveedor(args: Record<string, unknown>) {
  const items = (args.items as LineaItem[]) || [];
  if (!items.length) {
    return { content: [{ type: 'text', text: '⚠️ No se recibieron ítems para matchear.' }] };
  }

  const matches: ProductoMatch[] = [];
  for (const item of items) {
    matches.push(await matchearLinea(item));
  }

  const alta = matches.filter((m) => m.confianza === 'alta').length;
  const media = matches.filter((m) => m.confianza === 'media').length;
  const baja = matches.filter((m) => m.confianza === 'baja' || m.confianza === 'ninguna').length;

  const body = matches.map(renderMatch).join('\n\n');

  return {
    content: [{
      type: 'text',
      text:
        `## Resultado del matcheo de productos (${items.length} ítems)\n\n` +
        `✅ Alta confianza: **${alta}** | ⚠️ Media: **${media}** | ❌ Sin/baja: **${baja}**\n\n` +
        body +
        `\n\n---\n` +
        `Si los matches son correctos, llamá a \`cargar_documento_proveedor\` con los mismos datos.\n` +
        `Para items sin match, podés:\n` +
        `  - Pasar \`auto_crear_productos: true\` (los crea como productos nuevos).\n` +
        `  - O dejar que se carguen como descripción libre (default).`,
    }],
  };
}

export async function handleCargarDocumentoProveedor(args: Record<string, unknown>) {
  const client = getClient();
  const tipo = String(args.tipo_documento || '');
  const items = (args.items as LineaItem[]) || [];
  const autoCrearProveedor = Boolean(args.auto_crear_proveedor);
  const autoCrearProductos = Boolean(args.auto_crear_productos);

  if (tipo !== 'factura' && tipo !== 'orden_compra') {
    return {
      content: [{
        type: 'text',
        text:
          '⚠️ **Falta definir el tipo de documento.**\n\n' +
          'Preguntale al usuario: *¿Querés cargar esto como **factura de proveedor** o como **orden de compra**?*\n' +
          '- **factura**: registra la deuda contable (lo que vas a pagar).\n' +
          '- **orden_compra**: pedido previo a recibir mercadería.',
      }],
      isError: true,
    };
  }

  if (!items.length) {
    return { content: [{ type: 'text', text: '⚠️ No hay líneas para cargar.' }], isError: true };
  }

  // ─── 1. Resolver proveedor ─────────────────────────────────────────────────
  let proveedorId = args.proveedor_id ? String(args.proveedor_id) : undefined;
  let proveedorNombre = '';
  const proveedorNombreArg = args.proveedor_nombre ? String(args.proveedor_nombre) : undefined;
  const proveedorCuit = args.proveedor_cuit ? String(args.proveedor_cuit) : undefined;

  if (!proveedorId) {
    const res = await resolverProveedor(proveedorNombreArg, proveedorCuit);
    if (res.encontrado && res.id) {
      proveedorId = res.id;
      proveedorNombre = res.nombre || '';
    } else if (autoCrearProveedor && proveedorNombreArg) {
      const created = await client.post<unknown>('/api/semilla/partners', {
        name: proveedorNombreArg,
        supplier_rank: 1,
        customer_rank: 0,
        ...(proveedorCuit ? { vat: proveedorCuit } : {}),
      });
      const data = ((created as Record<string, unknown>)?.data ?? created) as Record<string, unknown>;
      proveedorId = String(data?.id || '');
      proveedorNombre = String(data?.name || proveedorNombreArg);
    } else {
      const candidatosText = res.candidatos.length
        ? `\n\nCandidatos posibles en el sistema:\n` +
          res.candidatos.slice(0, 5).map((c) =>
            `- \`${c.id}\` — ${c.name} (CUIT: ${c.vat || '—'})`
          ).join('\n')
        : '';
      return {
        content: [{
          type: 'text',
          text:
            `⚠️ **No se encontró el proveedor** "${proveedorNombreArg || proveedorCuit || ''}".${candidatosText}\n\n` +
            `Opciones:\n` +
            `  1. Pasá \`proveedor_id\` con el UUID del candidato correcto.\n` +
            `  2. Llamá de nuevo con \`auto_crear_proveedor: true\` para crearlo.\n`,
        }],
        isError: true,
      };
    }
  }

  // ─── 2. Matchear productos ────────────────────────────────────────────────
  const matches: ProductoMatch[] = [];
  for (const item of items) {
    matches.push(await matchearLinea(item));
  }

  // ─── 3. Crear productos faltantes si auto_crear_productos ────────────────
  const creados: { descripcion: string; id: string }[] = [];
  for (const m of matches) {
    if (m.producto_id) continue;
    if (!autoCrearProductos) continue;
    try {
      const created = await client.post<unknown>('/api/semilla/products', {
        name: m.linea.descripcion,
        unit_price: m.linea.precio_unitario || 0,
        cost_price: m.linea.precio_unitario || 0,
        is_active: true,
        ...(m.linea.codigo_proveedor ? { code: m.linea.codigo_proveedor } : {}),
        ...(m.linea.codigo_barras ? { barcode: m.linea.codigo_barras } : {}),
      });
      const data = ((created as Record<string, unknown>)?.data ?? created) as Record<string, unknown>;
      if (data?.id) {
        m.producto_id = String(data.id);
        m.producto_nombre = String(data?.name || m.linea.descripcion);
        m.metodo_match = 'sin_match';
        creados.push({ descripcion: m.linea.descripcion, id: m.producto_id });
      }
    } catch { /* Si falla la creación, la línea queda como texto libre */ }
  }

  // ─── 4. Crear el documento ────────────────────────────────────────────────
  const fecha = args.fecha ? String(args.fecha) : undefined;
  const fechaVenc = args.fecha_vencimiento ? String(args.fecha_vencimiento) : undefined;
  const numero = args.numero_factura ? String(args.numero_factura) : undefined;
  const notas = args.notas ? String(args.notas) : undefined;

  let documentoCreado: Record<string, unknown> | null = null;
  let endpointUsado = '';

  if (tipo === 'factura') {
    const body: Record<string, unknown> = {
      move_type: 'in_invoice',
      partner_id: proveedorId,
      invoice_line_ids: matches.map((m) => {
        const line: Record<string, unknown> = {
          name: m.linea.descripcion,
          quantity: m.linea.cantidad || 1,
          price_unit: m.linea.precio_unitario || 0,
        };
        if (m.producto_id) line.product_id = m.producto_id;
        return line;
      }),
    };
    if (fecha) body.invoice_date = fecha;
    if (fechaVenc) body.invoice_date_due = fechaVenc;
    if (numero) body.ref = numero;
    if (notas) body.narration = notas;

    endpointUsado = '/api/semilla/accounting/moves';
    const result = await client.post<unknown>(endpointUsado, body);
    documentoCreado = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;
  } else {
    // orden_compra
    const body: Record<string, unknown> = {
      partner_id: proveedorId,
      lines: matches
        .filter((m) => m.producto_id) // las OC requieren producto_id
        .map((m) => ({
          product_id: m.producto_id,
          quantity: m.linea.cantidad || 1,
          price_unit: m.linea.precio_unitario || 0,
        })),
    };
    if (notas) body.notes = notas;
    if (fecha) body.date_order = fecha;

    if (!(body.lines as unknown[]).length) {
      return {
        content: [{
          type: 'text',
          text:
            `⚠️ **No se puede crear la orden de compra**: ninguna línea tiene producto matcheado, ` +
            `y las OC requieren producto en el sistema. Volvé a llamar con \`auto_crear_productos: true\` ` +
            `o cargá esto como **factura** (acepta descripciones libres).`,
        }],
        isError: true,
      };
    }

    endpointUsado = '/api/semilla/purchases/orders';
    const result = await client.post<unknown>(endpointUsado, body);
    documentoCreado = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;
  }

  // ─── 5. Render del reporte ────────────────────────────────────────────────
  const totalMatcheadas = matches.filter((m) => m.producto_id && m.metodo_match !== 'sin_match').length;
  const totalConProducto = matches.filter((m) => m.producto_id).length;
  const totalSinProducto = matches.length - totalConProducto;

  const matchText = matches.map(renderMatch).join('\n\n');

  const tipoLabel = tipo === 'factura' ? 'Factura de proveedor' : 'Orden de compra';
  const docId = documentoCreado?.id || '—';
  const docName = documentoCreado?.name || '—';
  const docTotal = formatCurrency(Number(documentoCreado?.amount_total || 0));
  const docEstado = documentoCreado?.state || 'draft';

  let postSteps = '';
  if (tipo === 'factura') {
    postSteps =
      `\n**Próximos pasos:**\n` +
      `  - Revisar la factura en el ERP (queda en borrador).\n` +
      `  - Para confirmarla: usar \`postear_factura\` con ID \`${docId}\`.\n` +
      `  - Para registrar el pago: usar \`registrar_pago\`.`;
  } else {
    postSteps =
      `\n**Próximos pasos:**\n` +
      `  - Revisar la OC (queda en borrador).\n` +
      `  - El usuario puede confirmarla desde el ERP.\n` +
      `  - Cuando se reciba la mercadería, se factura desde la OC.`;
  }

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ ${tipoLabel} creada en BORRADOR\n\n` +
        `- **ID:** \`${docId}\`\n` +
        `- **Número interno:** ${docName}\n` +
        `${numero ? `- **Ref. proveedor:** ${numero}\n` : ''}` +
        `- **Proveedor:** ${proveedorNombre || proveedorId}\n` +
        `${fecha ? `- **Fecha:** ${formatDate(fecha)}\n` : ''}` +
        `- **Total:** ${docTotal}\n` +
        `- **Estado:** ${docEstado}\n\n` +
        `**Matcheo de productos:**\n` +
        `  ✅ Con match exacto: ${totalMatcheadas} | ` +
        `📌 Con producto (incl. creados): ${totalConProducto} | ` +
        `📝 Como descripción libre: ${totalSinProducto}\n\n` +
        (creados.length
          ? `**Productos creados automáticamente (${creados.length}):**\n` +
            creados.map((c) => `  - \`${c.id}\` — ${c.descripcion}`).join('\n') + '\n\n'
          : '') +
        `**Detalle de líneas:**\n${matchText}\n` +
        postSteps,
    }],
  };
}

export async function handleActualizarProductosLote(args: Record<string, unknown>) {
  const client = getClient();
  const actualizaciones = (args.actualizaciones as Record<string, unknown>[]) || [];

  if (!actualizaciones.length) {
    return { content: [{ type: 'text', text: '⚠️ No se recibieron actualizaciones.' }] };
  }

  const fieldMap: Record<string, string> = {
    nombre: 'name',
    sku: 'code',
    codigo_barras: 'barcode',
    precio_venta: 'unit_price',
    precio_costo: 'cost_price',
    categoria_id: 'category_id',
    activo: 'is_active',
    disponible_en_pos: 'available_in_pos',
  };

  let exitosos = 0;
  let fallidos = 0;
  const detalles: string[] = [];

  for (const upd of actualizaciones) {
    const productoId = String(upd.producto_id || '');
    if (!productoId) {
      fallidos++;
      detalles.push(`❌ Falta producto_id`);
      continue;
    }

    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(upd)) {
      if (k === 'producto_id') continue;
      if (v === undefined || v === null) continue;
      const erpField = fieldMap[k];
      if (erpField) body[erpField] = v;
    }

    if (!Object.keys(body).length) {
      fallidos++;
      detalles.push(`❌ \`${productoId}\` — sin campos a actualizar`);
      continue;
    }

    try {
      // Pre-fetch para no pisar campos requeridos
      try {
        const existing = await client.get<unknown>(`/api/semilla/products/${encodeURIComponent(productoId)}`);
        const data = ((existing as Record<string, unknown>)?.data ?? existing) as Record<string, unknown>;
        if (body.name === undefined && data.name) body.name = data.name;
        if (body.unit_price === undefined) body.unit_price = data.unit_price || data.list_price || 0;
        if (body.cost_price === undefined) body.cost_price = data.cost_price || data.standard_price || 0;
        if (body.is_active === undefined && data.is_active !== undefined) body.is_active = data.is_active;
      } catch { /* continúa con body parcial */ }

      await client.request<unknown>(
        `/api/semilla/products/${encodeURIComponent(productoId)}`,
        { method: 'PUT', body }
      );
      exitosos++;
      const cambios = Object.keys(body).filter((k) => fieldMap[Object.keys(fieldMap).find((mk) => fieldMap[mk] === k) || ''] === k || Object.values(fieldMap).includes(k)).join(', ');
      detalles.push(`✅ \`${productoId}\` — campos: ${cambios || Object.keys(body).join(', ')}`);
    } catch (err) {
      fallidos++;
      detalles.push(`❌ \`${productoId}\` — ${(err as Error).message}`);
    }
  }

  return {
    content: [{
      type: 'text',
      text:
        `## Actualización masiva de productos\n\n` +
        `✅ Exitosos: **${exitosos}** | ❌ Fallidos: **${fallidos}** (de ${actualizaciones.length})\n\n` +
        detalles.join('\n'),
    }],
  };
}

export async function handleActualizarContactosLote(args: Record<string, unknown>) {
  const client = getClient();
  const actualizaciones = (args.actualizaciones as Record<string, unknown>[]) || [];

  if (!actualizaciones.length) {
    return { content: [{ type: 'text', text: '⚠️ No se recibieron actualizaciones.' }] };
  }

  const fieldMap: Record<string, string> = {
    nombre: 'name',
    email: 'email',
    telefono: 'phone',
    cuit: 'vat',
    direccion: 'street',
    ciudad: 'city',
  };

  let exitosos = 0;
  let fallidos = 0;
  const detalles: string[] = [];

  for (const upd of actualizaciones) {
    const partnerId = String(upd.partner_id || '');
    if (!partnerId) {
      fallidos++;
      detalles.push(`❌ Falta partner_id`);
      continue;
    }

    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(upd)) {
      if (k === 'partner_id') continue;
      if (v === undefined || v === null) continue;
      if (k === 'es_cliente') { body.customer_rank = v ? 1 : 0; continue; }
      if (k === 'es_proveedor') { body.supplier_rank = v ? 1 : 0; continue; }
      const erpField = fieldMap[k];
      if (erpField) body[erpField] = v;
    }

    if (!Object.keys(body).length) {
      fallidos++;
      detalles.push(`❌ \`${partnerId}\` — sin campos a actualizar`);
      continue;
    }

    try {
      await client.request<unknown>(
        `/api/semilla/partners/${encodeURIComponent(partnerId)}`,
        { method: 'PUT', body }
      );
      exitosos++;
      detalles.push(`✅ \`${partnerId}\` — campos: ${Object.keys(body).join(', ')}`);
    } catch (err) {
      fallidos++;
      detalles.push(`❌ \`${partnerId}\` — ${(err as Error).message}`);
    }
  }

  return {
    content: [{
      type: 'text',
      text:
        `## Actualización masiva de contactos\n\n` +
        `✅ Exitosos: **${exitosos}** | ❌ Fallidos: **${fallidos}** (de ${actualizaciones.length})\n\n` +
        detalles.join('\n'),
    }],
  };
}

export async function handleSubirImagenesProductosLote(args: Record<string, unknown>) {
  const client = getClient();
  const imagenes = (args.imagenes as { producto_id: string; imagen_url: string }[]) || [];

  if (!imagenes.length) {
    return { content: [{ type: 'text', text: '⚠️ No se recibieron imágenes para subir.' }] };
  }

  let exitosos = 0;
  let fallidos = 0;
  const detalles: string[] = [];

  for (const { producto_id, imagen_url } of imagenes) {
    if (!producto_id || !imagen_url) {
      fallidos++;
      detalles.push(`❌ Faltan producto_id o imagen_url`);
      continue;
    }
    try {
      await client.uploadImageFromUrl<unknown>(
        `/api/semilla/products/${encodeURIComponent(producto_id)}/image`,
        imagen_url,
        'image'
      );
      exitosos++;
      detalles.push(`✅ \`${producto_id}\` ← ${imagen_url.slice(0, 80)}`);
    } catch (err) {
      fallidos++;
      detalles.push(`❌ \`${producto_id}\` — ${(err as Error).message}`);
    }
  }

  return {
    content: [{
      type: 'text',
      text:
        `## Subida masiva de imágenes\n\n` +
        `✅ Exitosos: **${exitosos}** | ❌ Fallidos: **${fallidos}** (de ${imagenes.length})\n\n` +
        detalles.join('\n'),
    }],
  };
}
