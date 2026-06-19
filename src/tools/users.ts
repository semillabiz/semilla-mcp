/**
 * Tools de Usuarios y Roles para Semilla MCP.
 * Endpoints: /api/semilla/users, /api/semilla/admin/roles
 *
 * Solo lectura — la gestión de altas/bajas/roles se hace desde la app web.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient, unwrap, unwrapArray } from '../client.js';

export const userTools: Tool[] = [
  {
    name: 'listar_usuarios',
    description: 'Lista los usuarios del tenant con su email y rol principal.',
    annotations: { title: 'Listar usuarios', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        activos: { type: 'boolean', description: 'Solo activos', default: true },
        limit: { type: 'number', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'get_perfil_usuario',
    description: 'Datos del usuario logueado (el dueño del JWT): nombre, email, roles, permisos.',
    annotations: { title: 'Ver perfil del usuario', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'listar_roles',
    description: 'Lista los roles disponibles en el tenant con cantidad de permisos asignados.',
    annotations: { title: 'Listar roles', readOnlyHint: true, openWorldHint: true },
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleListarUsuarios(args: Record<string, unknown>) {
  const client = getClient();
  const params: Record<string, string | number | boolean> = { limit: Number(args.limit || 50) };
  if (args.activos !== false) params.active = true;

  const result = await client.get<unknown>('/api/semilla/users', params);
  const users = unwrapArray(result);

  if (!users.length) return { content: [{ type: 'text', text: 'No hay usuarios.' }] };

  const rows = users.map((u) =>
    `- **${u.full_name || u.name || u.email}** | ${u.email} | ${u.role || u.primary_role || '—'}`
  );

  return { content: [{ type: 'text', text: `## Usuarios (${users.length})\n\n${rows.join('\n')}` }] };
}

export async function handleGetPerfilUsuario(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/users/profile');
  const u = unwrap<Record<string, unknown>>(result);

  return {
    content: [{
      type: 'text',
      text:
        `## Perfil\n\n` +
        `- **Nombre:** ${u?.full_name || u?.name || '—'}\n` +
        `- **Email:** ${u?.email || '—'}\n` +
        `- **Roles:** ${Array.isArray(u?.roles) ? (u.roles as string[]).join(', ') : (u?.role || '—')}\n` +
        `- **Tenant:** ${u?.tenant_code || u?.tenant_name || '—'}`,
    }],
  };
}

export async function handleListarRoles(_args: Record<string, unknown>) {
  const client = getClient();
  const result = await client.get<unknown>('/api/semilla/admin/roles');
  const roles = unwrapArray(result);

  if (!roles.length) return { content: [{ type: 'text', text: 'No hay roles definidos.' }] };

  const rows = roles.map((r) =>
    `- **${r.name}** | ${r.description || '—'} | ${(r.permissions as unknown[])?.length || 0} permisos`
  );

  return { content: [{ type: 'text', text: `## Roles (${roles.length})\n\n${rows.join('\n')}` }] };
}
