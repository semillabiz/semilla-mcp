/**
 * Tools del módulo Estudio Contable para Semilla MCP.
 * Endpoints: /api/semilla/accountants
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';

export const accountantTools: Tool[] = [
  {
    name: 'listar_clientes_estudio',
    description:
      'Lista todos los clientes del estudio contable: tenants Semilla vinculados y clientes externos. ' +
      'Usá esta tool cuando el usuario pregunte "¿cuántos clientes tengo?", "mostrá mi cartera de clientes" o similar.',
    annotations: { title: 'Listar clientes del estudio', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'resumen_estudio',
    description:
      'Métricas agregadas del estudio contable: total de clientes, clientes Semilla activos, ' +
      'libros externos y solicitudes pendientes.',
    annotations: { title: 'Resumen del estudio contable', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'crear_cliente_externo',
    description:
      'Crea un nuevo cliente externo (libro contable gestionado) en el estudio. ' +
      'El cliente no tiene cuenta en Semilla; el estudio lleva su contabilidad internamente.',
    annotations: { title: 'Crear cliente externo', readOnlyHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Razón social del cliente (requerido)',
        },
        tax_id: {
          type: 'string',
          description: 'CUIT del cliente (ej: 20-12345678-9)',
        },
        tax_responsibility_type: {
          type: 'string',
          enum: ['RI', 'Mono', 'EX', 'CF', 'otro'],
          description: 'Condición IVA: RI=Responsable Inscripto, Mono=Monotributista, EX=Exento, CF=Consumidor Final',
        },
        email: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'invitar_tenant_semilla',
    description:
      'Envía una solicitud de delegación contable a un tenant Semilla usando su código de conexión. ' +
      'El tenant deberá aceptar la invitación para que el estudio pueda operar su contabilidad.',
    annotations: { title: 'Invitar tenant Semilla', readOnlyHint: false, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Código de conexión del tenant destino (ej: SMC-ABCD)',
        },
        message: {
          type: 'string',
          description: 'Mensaje opcional para incluir en la invitación',
        },
      },
      required: ['identifier'],
    },
  },
];

export async function handleListarClientesEstudio(_params: Record<string, unknown>) {
  const client = getClient();
  const data = await client.get<Record<string, any>>('/api/semilla/accountants/clients');
  const semilla = data.data?.semilla_clients ?? [];
  const external = data.data?.external_books ?? [];
  return {
    semilla_clients: semilla.length,
    external_books: external.length,
    data: { semilla_clients: semilla, external_books: external },
  };
}

export async function handleResumenEstudio(_params: Record<string, unknown>) {
  const client = getClient();
  const data = await client.get<Record<string, any>>('/api/semilla/accountants/dashboard');
  return data.data;
}

export async function handleCrearClienteExterno(params: Record<string, unknown>) {
  const client = getClient();
  const data = await client.post<Record<string, any>>('/api/semilla/accountants/clients/external', params);
  return data.data;
}

export async function handleInvitarTenantSemilla(params: Record<string, unknown>) {
  const client = getClient();
  const data = await client.post<Record<string, any>>('/api/semilla/accountants/clients/invite', params);
  return data.data;
}
