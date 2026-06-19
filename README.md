# Semilla MCP Server

Servidor [Model Context Protocol](https://modelcontextprotocol.io) para [Semilla ERP](https://semilla.biz). Permite que clientes MCP como Claude Desktop, Claude Code y otros LLMs puedan consultar y operar tu ERP en lenguaje natural.

> **Resumen**: con este servidor instalado, podés decirle a Claude cosas como
> _"facturame al cliente Pérez 3 mesas a $50.000"_,
> _"abrime la mesa 4 y agregale 2 milanesas"_ o
> _"mostrame el resumen de ventas del mes"_, y Claude lo ejecuta directamente contra tu ERP.

---

## Tools incluidas

El servidor expone 259 tools agrupadas por módulo (ERP + Semilla Connect):

| Módulo | Tools | Ejemplos |
|---|---|---|
| **Sesión** | 3 | `login_semilla`, `logout_semilla`, `estado_sesion` |
| **Productos e inventario** | 9 | `buscar_productos`, `get_stock`, `ajustar_stock`, `get_movimientos_stock` |
| **Ventas** | 4 | `get_ventas`, `preview_crear_orden_venta`, `confirmar_crear_orden_venta` |
| **Compras** | 4 | `get_ordenes_compra`, `preview_crear_orden_compra`, `confirmar_crear_orden_compra` |
| **Clientes y proveedores** | 4 | `buscar_clientes`, `crear_cliente`, `get_historial_cliente` |
| **Contabilidad** | 8 | `get_diarios`, `crear_factura`, `postear_factura`, `registrar_pago` |
| **Reportes contables** | 4 | `get_libro_iva`, `get_libro_diario`, `get_balance_sumas_saldos`, `get_estado_resultados` |
| **Punto de Venta (POS)** | 4 | `get_sesiones_pos`, `get_ventas_pos`, `resumen_cierre_pos` |
| **Listas de precios** | 5 | `resolver_precio`, `crear_lista_precios`, `agregar_regla_precio` |
| **Imágenes de productos** | 5 | `subir_imagen_primaria`, `agregar_imagen_galeria` |
| **Usuarios y empresas** | 6 | `listar_usuarios`, `listar_empresas`, `listar_sucursales` |
| **Vertical: Gastronomía** | 11 | `gastro_get_mesas`, `gastro_abrir_mesa`, `gastro_pagar_mesa` |
| **Vertical: Hotelería** | 9 | `hosp_get_disponibilidad`, `hosp_check_in`, `hosp_check_out` |
| **Vertical: Salud** | 10 | `salud_buscar_pacientes`, `salud_get_agenda`, `salud_crear_appointment` |
| **Vertical: Agricultura** | 6 | `agro_get_lotes_fefo`, `agro_emitir_dav`, `agro_recalcular_regalias` |
| **Vertical: Logística** | 6 | `logis_listar_asignaciones`, `logis_crear_asignacion` |
| **Connect: Consumer** | 29 | `connect_consumer_appointments_book`, `connect_restaurants_create_order`, `connect_specialists_create_review`, `connect_users_follow`, `connect_payments_create_appointment_charge`, `connect_chats_send_message`, `connect_chats_mark_read` |
| **Connect: Especialista** | 20 | `connect_specialist_appointments_confirm`, `connect_specialist_patients_create`, `connect_specialist_patients_update`, `connect_specialist_patients_delete`, `connect_specialist_metrics_overview`, `connect_specialist_metrics_revenue_series`, `connect_payments_onboarding_start` |
| **Connect: Merchant (POS)** | 17 | `connect_merchant_pos_session_open`, `connect_merchant_pos_orders_create`, `connect_merchant_pos_products_get`, `connect_merchant_pos_products_create`, `connect_merchant_profile_get_mine` |
| **Connect: Gimnasio** | 12 | `connect_gym_members_create`, `connect_gym_members_checkout`, `connect_gym_access_checkin` |
| **Connect: Comunes** | 13 | `connect_posts_create`, `connect_posts_update`, `connect_posts_list_comments`, `connect_posts_like`, `connect_posts_feed_public`, `connect_users_get_by_username`, `connect_payments_charge_generic`, `connect_notifications_list` |

### Variables de entorno para Semilla Connect

Para que el MCP pueda invocar tools de Connect necesita:

```
SEMILLA_CONNECT_URL=https://connect.semilla.biz       # default: https://connect.semilla.biz
SEMILLA_CONNECT_API_KEY=<api-key-compartida>          # obligatoria; equivale a API_KEY del backend connect-shared
# Opcionales (override del user/tenant/business):
SEMILLA_CONNECT_USER_ID=<uuid>                         # si se omite, se intenta resolver del JWT del ERP
SEMILLA_CONNECT_TENANT_ID=<uuid>
SEMILLA_CONNECT_BUSINESS_ID=<uuid>
```

El user_id se resuelve en este orden: argumento explícito del tool → `SEMILLA_CONNECT_USER_ID` → claim `user_id`/`sub` del JWT del ERP. Cada tool acepta `user_id` opcional para sobreescribirlo por llamada (útil para automatizaciones multi-usuario).

---

## Requisitos

- **Node.js 18 o superior**
- Una cuenta activa de Semilla con acceso al ERP
- La URL de tu instancia del ERP (por ejemplo `https://erp.tu-empresa.com`)

> El MCP soporta **dos modos de autenticación**:
> 1. **Login seguro en el navegador (recomendado).** El MCP **nunca te pide email ni contraseña dentro del chat**: la tool `iniciar_login_semilla` genera un enlace, vos completás el login en una página segura de Semilla, y `confirmar_login_semilla` recibe el token. Tu contraseña nunca pasa por el modelo ni por el cliente MCP.
> 2. **JWT pre-generado** seteado como variable de entorno (recomendado si querés que arranque ya logueado, p. ej. en automatizaciones).

---

## Instalación

### Opción A — npx (recomendado)

No requiere instalación previa. Configurá tu cliente MCP con `npx -y semilla-mcp` (ver sección _Configuración_).

### Opción B — Instalación global

```bash
npm install -g semilla-mcp
```

### Opción C — Clonar el repo

```bash
git clone https://github.com/semilla-erp/semilla-mcp.git
cd semilla-mcp
npm install
npm run build
```

---

## Configuración

### Modo recomendado — Login seguro en el navegador

Sólo necesitás setear `SEMILLA_ERP_URL`. El primer prompt que le hacés a Claude es para que se logue. El login se completa en una página segura de Semilla: **tu contraseña nunca pasa por el chat ni por el modelo**.

#### Claude Desktop

Editar `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) o el equivalente en tu sistema:

```json
{
  "mcpServers": {
    "semilla": {
      "command": "npx",
      "args": ["-y", "semilla-mcp"],
      "env": {
        "SEMILLA_ERP_URL": "https://erp.tu-empresa.com"
      }
    }
  }
}
```

Reiniciar Claude Desktop. Deberían aparecer las tools `semilla` en el panel de conectores.

Después, en una conversación nueva:

> _"Conectate a mi cuenta de Semilla (cliente: miempresa)"_

Claude usa la tool `iniciar_login_semilla`, te muestra un enlace para iniciar sesión en una página segura de Semilla y, al terminar, queda autenticado con `confirmar_login_semilla` para el resto de la conversación. **No le pases tu contraseña en el chat** — el login se hace siempre en el navegador.

#### Claude Code

```bash
claude mcp add semilla npx -y semilla-mcp \
  -e SEMILLA_ERP_URL=https://erp.tu-empresa.com
```

### Modo alternativo — JWT pre-generado

Si querés que arranque ya logueado (sin pedirle a Claude que haga login cada vez), generás el JWT manualmente y lo seteás en el config:

```bash
# Obtener el JWT vía curl:
curl -X POST https://erp.tu-empresa.com/api/semilla/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: miempresa" \
  -d '{"email":"maria@empresa.com","password":"********","clientId":"miempresa"}' \
  | jq -r .token
```

Y agregás `SEMILLA_JWT_TOKEN` al config:

```json
{
  "mcpServers": {
    "semilla": {
      "command": "npx",
      "args": ["-y", "semilla-mcp"],
      "env": {
        "SEMILLA_ERP_URL": "https://erp.tu-empresa.com",
        "SEMILLA_JWT_TOKEN": "eyJhbGciOiJIUzI1NiIsInR..."
      }
    }
  }
}
```

> **Importante**: el JWT define a qué tenant y con qué permisos opera el MCP. Tratalo como una contraseña: nunca commitees el config con el token real, no lo compartas, y rotalo si lo exponés por error.

### Tools de sesión

- `iniciar_login_semilla({ client_id })` — **(recomendada)** genera el enlace de login seguro en el navegador.
- `confirmar_login_semilla()` — espera a que completes el login en el navegador y guarda el token.
- `logout_semilla()` — cierra la sesión actual.
- `estado_sesion()` — verifica si hay sesión activa.
- `login_semilla({ email, password, client_id })` — **(legacy, desaconsejada)** login directo con email + contraseña. Solo para scripts/entornos controlados; expone credenciales al cliente MCP. Preferí siempre el login seguro en el navegador.

---

## Patrón preview / confirm

Las tools que escriben datos críticos (ventas, compras, pagos, reservas, etc.) están divididas en dos pasos:

- `preview_*` — calcula y muestra lo que se va a crear, **sin tocar el ERP**.
- `confirmar_*` — ejecuta la acción real.

Esto hace que el LLM siempre te muestre un resumen antes de impactar tu ERP. El cliente MCP (Claude) te pide confirmación entre los dos pasos.

---

## Ejemplos de uso

| Tu prompt | Tool que invoca |
|---|---|
| _"¿cuánto vendí hoy?"_ | `get_ventas` |
| _"buscame el cliente Pérez"_ | `buscar_clientes` |
| _"facturale a Pérez 3 sillas a $20.000 cada una"_ | `preview_crear_orden_venta` → `confirmar_crear_orden_venta` → `crear_factura` → `postear_factura` |
| _"qué stock tengo del producto SKU-001"_ | `get_stock` |
| _"cerrá la mesa 4"_ | `gastro_preview_pagar_mesa` → `gastro_confirmar_pagar_mesa` |
| _"hay habitaciones libres del 10 al 15?"_ | `hosp_get_disponibilidad` |
| _"agendame turno con la Dra. López el lunes a las 10"_ | `salud_preview_crear_appointment` → `salud_confirmar_crear_appointment` |

---

## Desarrollo

```bash
npm run dev      # tsx watch — recarga al guardar
npm run build    # tsc → dist/
npm run inspect  # abre el MCP Inspector contra el server local
```

### Agregar una tool nueva

1. Crear `src/tools/<modulo>.ts` con un array `<modulo>Tools: Tool[]` y handlers `handleXxx`.
2. Importar y registrar en 3 puntos de `src/index.ts`:
   - `import` arriba
   - `...miModuloTools` en `ListToolsRequestSchema`
   - `case 'mi_tool': return await handleMiTool(safeArgs);` en el switch

Naming: tools en `snake_case` español, handlers en `handleCamelCase`.

---

## Seguridad

- **Autenticación sin exponer credenciales:** el login recomendado se hace en una página segura de Semilla (device flow); tu contraseña nunca pasa por el modelo ni por el cliente MCP. La tool `login_semilla` (email + contraseña directa) queda como legacy y desaconsejada.
- El JWT da acceso al tenant y módulos para los que se generó. **No** da acceso administrativo cross-tenant.
- Las tools de **escritura crítica** usan el patrón preview/confirm para que veas qué va a pasar antes de ejecutar.
- Las tools de **datos sensibles** (recetas médicas, historias clínicas) son **solo lectura** en este MCP. Las acciones críticas legales se hacen siempre desde la app web.
- El servidor corre **localmente** en tu máquina (stdio). No hay servidor intermedio entre tu cliente MCP y el ERP.

### Matriz de riesgo por tipo de tool

Cada tool está anotada con `readOnlyHint` / `destructiveHint` / `idempotentHint` para que el cliente MCP sepa su impacto. Esta es la guía de a qué nivel de riesgo corresponde cada familia:

| Nivel | Qué hace | Anotaciones | Ejemplos |
|---|---|---|---|
| **read** | Solo lectura, no modifica nada | `readOnlyHint: true` | `get_ventas`, `buscar_clientes`, `get_stock`, `salud_get_paciente` |
| **low** | Escritura reversible o de bajo impacto | `readOnlyHint: false`, `destructiveHint: false` | `actualizar_producto`, `chatter_agregar_nota`, `connect_users_follow` |
| **moderate** | Crea obligaciones comerciales o mueve flujo de caja | `readOnlyHint: false`, `destructiveHint: false` | `confirmar_crear_orden_venta`, `connect_merchant_pos_orders_create`, `connect_payments_create_order_charge` |
| **critical** | Irreversible / legal / contable | `readOnlyHint: false`, `destructiveHint: true` | `postear_factura`, `agro_confirmar_emitir_dav`, `cargar_documento_proveedor` |

Las acciones **moderate** y **critical** pasan siempre por el patrón preview/confirm: el LLM te muestra el resumen del impacto y vos confirmás antes de ejecutar.

---

## Política de Privacidad

_Privacy Policy. Última actualización: 2026-06-19._

Este conector es un servidor MCP **local**: corre en tu máquina (transporte stdio) y se comunica únicamente con la instancia del ERP de Semilla y, opcionalmente, con el backend de Semilla Connect que vos configurás. Semilla no opera ningún servidor intermedio que reciba tus datos a través de este conector.

**Recolección de datos (data collection).** El conector no recolecta ni envía telemetría propia. Para funcionar, accede bajo demanda a los datos de negocio de tu cuenta del ERP (ventas, compras, contabilidad, inventario, clientes/proveedores, POS, y datos de los verticales habilitados) y, si usás Semilla Connect, a datos de turnos, pedidos, perfiles y pagos. Solo lee/escribe lo que la tool invocada requiere.

**Uso y almacenamiento (usage and storage).** Las credenciales de acceso (el token JWT del ERP y, si aplica, la API key de Connect) se mantienen en variables de entorno y en la memoria del proceso local mientras el conector está corriendo. **No se persisten en disco por el conector** ni se envían a terceros. Los datos de negocio que devuelven las tools se entregan al cliente MCP (p. ej. Claude Desktop) para mostrarte la respuesta; su tratamiento posterior queda bajo la política del cliente MCP que estés usando.

**Compartir con terceros (third-party sharing).** El conector **no comparte datos con terceros**. Todo el tráfico va exclusivamente a los endpoints que configurás: `SEMILLA_ERP_URL` y, opcionalmente, `SEMILLA_CONNECT_URL`. No hay analytics, ni tracking, ni envío de datos a Semilla fuera de tu propia instancia.

**Retención de datos (data retention).** El conector no retiene datos: no guarda historiales, caches persistentes ni copias de tus registros. La retención de los datos de negocio la define tu instancia del ERP de Semilla, según sus propias políticas. Al cerrar el proceso, el token en memoria se descarta.

**Contacto (contact information).** Por consultas de privacidad: **soporte@semilla.biz** · https://semilla.biz. Política completa: https://semilla.biz/documentacion/semilla-mcp/privacidad

---

## Licencia

[MIT](LICENSE)

---

## Soporte

- Documentación de Semilla: https://semilla.biz/documentacion
- Documentación del MCP: https://semilla.biz/documentacion/semilla-mcp
- Issues: https://github.com/semilla-erp/semilla-mcp/issues
