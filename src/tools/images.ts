/**
 * Tools de gestión de imágenes para productos en Semilla MCP.
 * Endpoints:
 *   POST   /api/semilla/products/:id/image           — imagen primaria
 *   GET    /api/semilla/products/:id/images           — galería
 *   POST   /api/semilla/products/:id/images           — agregar a galería
 *   PATCH  /api/semilla/products/:id/images/:imgId/primary — set primaria
 *   DELETE /api/semilla/products/:id/images/:imgId    — eliminar de galería
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getClient } from '../client.js';

// ─── Definiciones de tools ────────────────────────────────────────────────────

export const imageTools: Tool[] = [
  {
    name: 'subir_imagen_primaria',
    description:
      'Sube o reemplaza la imagen principal de un producto. ' +
      'Descarga la imagen desde una URL pública y la establece como imagen primaria del producto. ' +
      'Funciona tanto para productos simples como para variantes. ' +
      'Si no sabés el ID del producto, primero usá buscar_productos.',
    annotations: { title: 'Subir imagen primaria', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto al que asignar la imagen',
        },
        imagen_url: {
          type: 'string',
          description: 'URL pública de la imagen a subir (jpg, png, webp, gif)',
        },
      },
      required: ['producto_id', 'imagen_url'],
    },
  },
  {
    name: 'listar_imagenes_producto',
    description:
      'Lista todas las imágenes de la galería de un producto. ' +
      'Devuelve ID, URL, orden y si es la imagen primaria. ' +
      'Usá el ID de imagen con set_imagen_primaria o eliminar_imagen_galeria.',
    annotations: { title: 'Listar imágenes del producto', readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto',
        },
      },
      required: ['producto_id'],
    },
  },
  {
    name: 'agregar_imagen_galeria',
    description:
      'Agrega una imagen adicional a la galería de un producto (pestaña "Imágenes"). ' +
      'La primera imagen agregada se marca automáticamente como primaria. ' +
      'Descarga desde una URL pública y la agrega a la colección del producto.',
    annotations: { title: 'Agregar imagen a galería', readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto',
        },
        imagen_url: {
          type: 'string',
          description: 'URL pública de la imagen a agregar',
        },
      },
      required: ['producto_id', 'imagen_url'],
    },
  },
  {
    name: 'set_imagen_primaria',
    description:
      'Marca una imagen de la galería como la imagen principal del producto. ' +
      'Usá listar_imagenes_producto para obtener el imagen_id.',
    annotations: { title: 'Marcar imagen como primaria', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto',
        },
        imagen_id: {
          type: 'string',
          description: 'UUID de la imagen a marcar como primaria',
        },
      },
      required: ['producto_id', 'imagen_id'],
    },
  },
  {
    name: 'eliminar_imagen_galeria',
    description:
      'Elimina una imagen de la galería de un producto. ' +
      'Usá listar_imagenes_producto para obtener el imagen_id. ' +
      '⚠️ Esta acción no se puede deshacer.',
    annotations: { title: 'Eliminar imagen de galería', readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        producto_id: {
          type: 'string',
          description: 'UUID del producto',
        },
        imagen_id: {
          type: 'string',
          description: 'UUID de la imagen a eliminar',
        },
      },
      required: ['producto_id', 'imagen_id'],
    },
  },
];

// ─── Handlers ─────────────────────────────────────────────────────────────────

export async function handleSubirImagenPrimaria(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);
  const imagenUrl = String(args.imagen_url);

  const result = await client.uploadImageFromUrl<Record<string, unknown>>(
    `/api/semilla/products/${encodeURIComponent(productoId)}/image`,
    imagenUrl,
    'image'
  );

  const data = (result?.data as Record<string, unknown>) ?? result;
  const imageUrl = data?.image_url as string | undefined;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Imagen primaria actualizada\n\n` +
        `Producto ID: \`${productoId}\`\n` +
        (imageUrl ? `URL en el servidor: ${imageUrl}\n` : '') +
        `\nLa imagen fue descargada desde:\n${imagenUrl}`,
    }],
  };
}

export async function handleListarImagenesProducto(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);

  const result = await client.get<unknown>(`/api/semilla/products/${encodeURIComponent(productoId)}/images`);
  const images: Record<string, unknown>[] = Array.isArray(result)
    ? result as Record<string, unknown>[]
    : ((result as Record<string, unknown>)?.data as Record<string, unknown>[]) || [];

  if (!images.length) {
    return {
      content: [{
        type: 'text',
        text: `Este producto no tiene imágenes en la galería.\n\nUsá \`agregar_imagen_galeria\` para añadir una.`,
      }],
    };
  }

  const rows = images.map((img, i) => {
    const primary = img.is_primary ? ' ⭐ (primaria)' : '';
    const order = img.image_order !== undefined ? ` | Orden: ${img.image_order}` : '';
    return `${i + 1}. **ID:** \`${img.id}\`${primary}${order}\n   URL: ${img.image_url || '—'}`;
  });

  return {
    content: [{
      type: 'text',
      text:
        `## Galería de imágenes (${images.length})\n\n` +
        rows.join('\n\n') +
        `\n\n---\n` +
        `- \`set_imagen_primaria\` — marcar como primaria\n` +
        `- \`eliminar_imagen_galeria\` — eliminar imagen`,
    }],
  };
}

export async function handleAgregarImagenGaleria(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);
  const imagenUrl = String(args.imagen_url);

  const result = await client.uploadImageFromUrl<Record<string, unknown>>(
    `/api/semilla/products/${encodeURIComponent(productoId)}/images`,
    imagenUrl,
    'image'
  );

  const data = (result?.data as Record<string, unknown>) ?? result;

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Imagen agregada a la galería\n\n` +
        `Producto ID: \`${productoId}\`\n` +
        (data?.id ? `Imagen ID: \`${data.id}\`\n` : '') +
        (data?.is_primary ? `⭐ Esta imagen fue marcada como primaria (primera imagen)\n` : '') +
        `\nDescargada desde:\n${imagenUrl}`,
    }],
  };
}

export async function handleSetImagenPrimaria(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);
  const imagenId = String(args.imagen_id);

  await client.request<unknown>(
    `/api/semilla/products/${encodeURIComponent(productoId)}/images/${encodeURIComponent(imagenId)}/primary`,
    { method: 'PATCH' }
  );

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Imagen primaria actualizada\n\n` +
        `Producto ID: \`${productoId}\`\n` +
        `La imagen \`${imagenId}\` ahora es la imagen principal.`,
    }],
  };
}

export async function handleEliminarImagenGaleria(args: Record<string, unknown>) {
  const client = getClient();
  const productoId = String(args.producto_id);
  const imagenId = String(args.imagen_id);

  await client.request<unknown>(
    `/api/semilla/products/${encodeURIComponent(productoId)}/images/${encodeURIComponent(imagenId)}`,
    { method: 'DELETE' }
  );

  return {
    content: [{
      type: 'text',
      text:
        `## ✅ Imagen eliminada\n\n` +
        `Imagen \`${imagenId}\` eliminada del producto \`${productoId}\`.`,
    }],
  };
}
