# Changelog

Todos los cambios notables a este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.1] — 2026-06-19

### Cambiado — Preparación para el MCP Directory de Anthropic
- **`title` en las 259 tools.** Cada tool ahora declara `annotations.title` (requisito del MCP Directory),
  además de los `readOnlyHint`/`destructiveHint` ya existentes.
- **README:** nueva sección **Política de Privacidad** (recolección, uso/almacenamiento, terceros,
  retención y contacto), **matriz de riesgo** por tipo de tool, y documentación del **login seguro en el
  navegador** como método recomendado (la tool `login_semilla` queda como legacy/desaconsejada).
- **`manifest.json`** (manifest_version 0.2) para empaquetar como Desktop Extension, con `user_config`
  para las variables de entorno y `privacy_policies`.
- **Versión del server** sincronizada con `package.json` (antes declaraba 1.1.0).

### Corregido
- `mercado-libre.ts`: los fallos reales del backend ahora devuelven `isError: true` de forma consistente.

### Agregado
- `npm run verify:tools`: chequeo de que toda tool tiene `title` + hint, sin duplicados y con dispatch en
  `index.ts` (corre también en `prepublishOnly`).

## [1.1.0] — 2026-05-15

### Agregado — Carga inteligente e ingesta masiva
- **`cargar_documento_proveedor`** — crea factura de proveedor u orden de compra en BORRADOR a partir
  de datos extraídos por Claude de un PDF/imagen. Resuelve proveedor por CUIT/nombre y matchea cada
  línea con el catálogo automáticamente (SKU → código de barras → nombre normalizado). Soporta
  `auto_crear_proveedor` y `auto_crear_productos` para el faltante.
- **`matchear_productos_proveedor`** — preview del matcheo antes de crear el documento. Devuelve
  confianza (alta/media/baja) y alternativas para revisar.
- **`actualizar_productos_lote`** — actualiza N productos en una sola tool call (precios, SKUs,
  categorías, estado, disponibilidad en POS).
- **`actualizar_contactos_lote`** — actualiza N contactos (clientes/proveedores) en una sola call.
- **`subir_imagenes_productos_lote`** — sube imágenes primarias para N productos desde URLs públicas.

### Cambiado
- Instrucciones del server actualizadas con el flujo prioritario PDF → factura/OC en borrador.
  Claude ahora pregunta explícitamente al usuario "¿factura o orden de compra?" antes de cargar.

## [1.0.0] — 2026-05-14

### Agregado
- Servidor MCP base sobre `@modelcontextprotocol/sdk`.
- Tools de productos e inventario: `buscar_productos`, `get_stock`, `actualizar_producto`, `asignar_sku_lote`, `buscar_productos_sin_sku`, `get_categorias`, `get_niveles_stock`, `get_movimientos_stock`, `ajustar_stock`.
- Tools de imágenes de productos: `subir_imagen_primaria`, `listar_imagenes_producto`, `agregar_imagen_galeria`, `set_imagen_primaria`, `eliminar_imagen_galeria`.
- Tools de ventas con patrón preview/confirm: `get_ventas`, `get_orden_venta`, `preview_crear_orden_venta`, `confirmar_crear_orden_venta`.
- Tools de compras con patrón preview/confirm: `get_ordenes_compra`, `get_orden_compra`, `preview_crear_orden_compra`, `confirmar_crear_orden_compra`.
- Tools de clientes y proveedores: `buscar_clientes`, `get_historial_cliente`, `crear_cliente`, `actualizar_cliente`.
- Tools de contabilidad: `get_resumen_financiero`, `get_facturas_pendientes`, `get_diarios`, `crear_factura`, `postear_factura`, `registrar_pago`.
- Tools de reportes contables: `get_libro_iva`, `get_libro_diario`, `get_balance_sumas_saldos`, `get_estado_resultados`.
- Tools de POS: `get_sesiones_pos`, `get_sesion_pos`, `get_ventas_pos`, `resumen_cierre_pos`.
- Tools de listas de precios: `get_listas_precios`, `get_lista_precios`, `resolver_precio`, `crear_lista_precios`, `agregar_regla_precio`.
- Tools de usuarios y empresas: `listar_usuarios`, `get_perfil_usuario`, `listar_roles`, `listar_empresas`, `get_empresa`, `listar_sucursales`.
- Vertical Gastronomía: 11 tools (mesas, platos, sesiones de mesa, cocina, reservas).
- Vertical Hotelería: 9 tools (habitaciones, disponibilidad, reservas, check-in/out).
- Vertical Salud: 10 tools (pacientes, agenda, profesionales, citas, recetas en lectura).
- Vertical Agricultura: 6 tools (FEFO, genealogía de lotes, análisis, DAVs, regalías).
- Vertical Logística: 6 tools (categorías, productos, empleados, asignaciones).
- **Tools de sesión**: `login_semilla`, `logout_semilla`, `estado_sesion` para iniciar sesión interactivamente desde el cliente MCP (Claude Desktop, etc.) sin necesidad de generar el JWT manualmente.
- `SEMILLA_JWT_TOKEN` ahora es **opcional**: si no está, el MCP arranca y espera a que se llame `login_semilla`.
- Helper `unwrap()` y `unwrapArray()` en `client.ts` para normalizar respuestas del ERP.
- Empaquetado para `npx semilla-mcp` (campo `bin`).
- Documentación: `README.md`, `.env.example`, `LICENSE` (MIT).
