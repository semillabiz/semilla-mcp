/**
 * Tools de escritura de partners (clientes/proveedores) para Semilla MCP.
 * Complementa customers.ts (lectura). Endpoints: /api/semilla/partners
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';

export const partnersWriteTools: Tool[] = [
  {
    name: 'crear_cliente',
    description:
      'Crea un nuevo cliente, proveedor o contacto en el sistema. ' +
      'Podés especificar si es cliente, proveedor o ambos.',
    annotations: { title: 'Crear cliente', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          description: 'Nombre completo o razón social',
        },
        email: {
          type: 'string',
          description: 'Email de contacto (opcional)',
        },
        telefono: {
          type: 'string',
          description: 'Teléfono (opcional)',
        },
        cuit: {
          type: 'string',
          description: 'CUIT/CUIL (sin guiones, ej: 20123456789)',
        },
        es_cliente: {
          type: 'boolean',
          description: 'Si true, se marca como cliente (default: true)',
          default: true,
        },
        es_proveedor: {
          type: 'boolean',
          description: 'Si true, se marca como proveedor (default: false)',
          default: false,
        },
        direccion: {
          type: 'string',
          description: 'Dirección (calle y número, opcional)',
        },
        ciudad: {
          type: 'string',
          description: 'Ciudad (opcional)',
        },
        pais: {
          type: 'string',
          description: 'País (default: Argentina)',
          default: 'Argentina',
        },
        tipo_responsabilidad_iva: {
          type: 'string',
          enum: ['consumidor_final', 'responsable_inscripto', 'monotributista', 'exento'],
          description: 'Condición ante IVA (opcional)',
        },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'actualizar_cliente',
    description:
      'Actualiza los datos de un cliente o proveedor existente. ' +
      'Solo se modifican los campos que se proveen.',
    annotations: { title: 'Actualizar cliente', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        partner_id: {
          type: 'string',
          description: 'UUID del cliente/proveedor a actualizar',
        },
        nombre: {
          type: 'string',
          description: 'Nuevo nombre (opcional)',
        },
        email: {
          type: 'string',
          description: 'Nuevo email (opcional)',
        },
        telefono: {
          type: 'string',
          description: 'Nuevo teléfono (opcional)',
        },
        cuit: {
          type: 'string',
          description: 'Nuevo CUIT/CUIL (opcional)',
        },
        direccion: {
          type: 'string',
          description: 'Nueva dirección (opcional)',
        },
        ciudad: {
          type: 'string',
          description: 'Nueva ciudad (opcional)',
        },
        es_cliente: {
          type: 'boolean',
          description: 'Marcar/desmarcar como cliente (opcional)',
        },
        es_proveedor: {
          type: 'boolean',
          description: 'Marcar/desmarcar como proveedor (opcional)',
        },
      },
      required: ['partner_id'],
    },
  },
];

// ─── IVA responsibility mapping ────────────────────────────────────────────────

const ivaMap: Record<string, string> = {
  consumidor_final: 'CF',
  responsable_inscripto: 'RI',
  monotributista: 'MT',
  exento: 'EX',
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleCrearCliente(args: Record<string, unknown>) {
  const client = getClient();
  const {
    nombre, email, telefono, cuit,
    es_cliente, es_proveedor,
    direccion, ciudad, pais, tipo_responsabilidad_iva,
  } = args as {
    nombre: string;
    email?: string;
    telefono?: string;
    cuit?: string;
    es_cliente?: boolean;
    es_proveedor?: boolean;
    direccion?: string;
    ciudad?: string;
    pais?: string;
    tipo_responsabilidad_iva?: string;
  };

  const body: Record<string, unknown> = {
    name: nombre,
    customer_rank: es_cliente !== false ? 1 : 0,
    supplier_rank: es_proveedor ? 1 : 0,
  };
  if (email) body.email = email;
  if (telefono) body.phone = telefono;
  if (cuit) body.vat = cuit;
  if (direccion) body.street = direccion;
  if (ciudad) body.city = ciudad;
  if (pais) body.country = pais;
  if (tipo_responsabilidad_iva && ivaMap[tipo_responsabilidad_iva]) {
    body.l10n_ar_afip_responsibility_type = ivaMap[tipo_responsabilidad_iva];
  }

  const result = await client.post<unknown>('/api/semilla/partners', body);
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Cliente creado\n\n` +
        `- **ID:** \`${data?.id || '—'}\`\n` +
        `- **Nombre:** ${data?.name || nombre}\n` +
        `${email ? `- **Email:** ${email}\n` : ''}` +
        `${cuit ? `- **CUIT:** ${cuit}\n` : ''}` +
        `- **Es cliente:** ${es_cliente !== false ? 'Sí' : 'No'}\n` +
        `- **Es proveedor:** ${es_proveedor ? 'Sí' : 'No'}`,
    }],
  };
}

export async function handleActualizarCliente(args: Record<string, unknown>) {
  const client = getClient();
  const { partner_id, nombre, email, telefono, cuit, direccion, ciudad, es_cliente, es_proveedor } = args as {
    partner_id: string;
    nombre?: string;
    email?: string;
    telefono?: string;
    cuit?: string;
    direccion?: string;
    ciudad?: string;
    es_cliente?: boolean;
    es_proveedor?: boolean;
  };

  const body: Record<string, unknown> = {};
  if (nombre !== undefined) body.name = nombre;
  if (email !== undefined) body.email = email;
  if (telefono !== undefined) body.phone = telefono;
  if (cuit !== undefined) body.vat = cuit;
  if (direccion !== undefined) body.street = direccion;
  if (ciudad !== undefined) body.city = ciudad;
  if (es_cliente !== undefined) body.customer_rank = es_cliente ? 1 : 0;
  if (es_proveedor !== undefined) body.supplier_rank = es_proveedor ? 1 : 0;

  if (Object.keys(body).length === 0) {
    return { content: [{ type: 'text', text: 'No se especificaron campos a actualizar.' }] };
  }

  const result = await client.request<unknown>(`/api/semilla/partners/${partner_id}`, {
    method: 'PUT',
    body,
  });
  const data = ((result as Record<string, unknown>)?.data ?? result) as Record<string, unknown>;

  const updatedFields = Object.keys(body).map((k) => `\`${k}\``).join(', ');

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Partner actualizado\n\n` +
        `- **ID:** \`${partner_id}\`\n` +
        `- **Nombre:** ${data?.name || nombre || '—'}\n` +
        `- **Campos actualizados:** ${updatedFields}`,
    }],
  };
}
