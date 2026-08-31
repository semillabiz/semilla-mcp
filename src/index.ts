#!/usr/bin/env node
/**
 * Semilla MCP Server
 * Expone datos del ERP Semilla a Claude Desktop via Model Context Protocol.
 *
 * Uso:
 *   tsx src/index.ts          (desarrollo)
 *   node dist/index.js        (producción)
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Tools
import { productTools, handleBuscarProductos, handleGetStock } from './tools/products.js';
import { productWriteTools, handleActualizarProducto, handleAsignarSkuLote, handleBuscarProductosSinSku, handleGetCategorias } from './tools/products-write.js';
import {
  salesTools,
  handleGetVentas,
  handleGetOrdenVenta,
  handlePreviewCrearOrden,
  handleConfirmarCrearOrden,
} from './tools/sales.js';
import { customerTools, handleBuscarClientes, handleGetHistorialCliente } from './tools/customers.js';
import { accountingTools, handleGetFacturas, handleGetResumenFinanciero, handleGetFacturasPendientes } from './tools/accounting.js';
import {
  imageTools,
  handleSubirImagenPrimaria,
  handleListarImagenesProducto,
  handleAgregarImagenGaleria,
  handleSetImagenPrimaria,
  handleEliminarImagenGaleria,
} from './tools/images.js';
import {
  posTools,
  handleGetSesionesPOS,
  handleGetSesionPOS,
  handleGetVentasPOS,
  handleResumenCierrePOS,
} from './tools/pos.js';
import {
  inventoryTools,
  handleGetNivelesStock,
  handleGetMovimientosStock,
  handleAjustarStock,
} from './tools/inventory.js';
import {
  purchaseTools,
  handleGetOrdenesCompra,
  handleGetOrdenCompra,
  handlePreviewCrearOrdenCompra,
  handleConfirmarCrearOrdenCompra,
} from './tools/purchases.js';
import {
  accountingWriteTools,
  handleGetDiarios,
  handleCrearFactura,
  handlePostearFactura,
  handleRegistrarPago,
} from './tools/accounting-write.js';
import {
  partnersWriteTools,
  handleCrearCliente,
  handleActualizarCliente,
} from './tools/partners-write.js';
import {
  priceListTools,
  handleGetListasPrecios,
  handleGetListaPrecios,
  handleResolverPrecio,
  handleCrearListaPrecios,
  handleAgregarReglaPrecio,
} from './tools/price-lists.js';
import {
  gastronomyTools,
  handleGastroGetDashboard,
  handleGastroGetMesas,
  handleGastroListarPlatos,
  handleGastroSetPlatoDisponibilidad,
  handleGastroAbrirMesa,
  handleGastroGetSesionMesa,
  handleGastroAgregarItemMesa,
  handleGastroPedirCuenta,
  handleGastroPreviewPagarMesa,
  handleGastroConfirmarPagarMesa,
  handleGastroGetCocinaTickets,
  handleGastroListarReservas,
} from './tools/gastronomy.js';
import {
  hospitalityTools,
  handleHospGetDashboard,
  handleHospListarHabitaciones,
  handleHospListarTiposHabitacion,
  handleHospGetDisponibilidad,
  handleHospListarReservas,
  handleHospPreviewCrearReserva,
  handleHospConfirmarCrearReserva,
  handleHospCheckIn,
  handleHospCheckOut,
} from './tools/hospitality.js';
import {
  healthTools,
  handleSaludGetDashboard,
  handleSaludBuscarPacientes,
  handleSaludGetPaciente,
  handleSaludPreviewCrearPaciente,
  handleSaludConfirmarCrearPaciente,
  handleSaludListarProfesionales,
  handleSaludGetHorariosProfesional,
  handleSaludGetAgenda,
  handleSaludListarAppointments,
  handleSaludPreviewCrearAppointment,
  handleSaludConfirmarCrearAppointment,
  handleSaludListarRecetas,
  handleSaludDentalListarPresupuestos,
  handleSaludDentalCuentaPaciente,
  handleSaludDentalBuscarNomenclador,
} from './tools/health.js';
import {
  agricultureTools,
  handleAgroGetDashboard,
  handleAgroGetLotesFefo,
  handleAgroGetGenealogiaLote,
  handleAgroCalcularResultadoAnalisis,
  handleAgroPreviewEmitirDav,
  handleAgroConfirmarEmitirDav,
  handleAgroRecalcularRegalias,
  handleAgroGetStockPorPropietario,
  handleAgroGetCruzamientos,
  handleAgroGetCruzamientoGenealogia,
  handleAgroGetEnsayos,
  handleAgroGetEnsayoResumen,
  handleAgroGetLaboresParcela,
  handleAgroRegistrarLaborCultural,
  handleAgroGetLibretaTimeline,
  handleAgroRegistrarEntradaLibreta,
  handleAgroGetCamposOperativos,
  handleAgroGetParcelaTimeline,
  handleAgroDeclararParcela,
  handleAgroRegistrarCosecha,
  handleAgroLotesVendibles,
  handleAgroVentaDespacho,
  handleAgroSetCampoUbicacion,
  handleAgroGetClimaCampo,
  handleAgroGetFenologia,
} from './tools/agriculture.js';
import {
  logisticsTools,
  handleLogisGetDashboard,
  handleLogisListarCategorias,
  handleLogisListarProductos,
  handleLogisListarEmpleados,
  handleLogisListarAsignaciones,
  handleLogisPreviewCrearAsignacion,
  handleLogisConfirmarCrearAsignacion,
} from './tools/logistics.js';
import {
  automationsTools,
  handleAutomationsCatalogoNodos,
  handleAutomationsListar,
  handleAutomationsProbarRegla,
  handleAutomationsPreviewCrearRegla,
  handleAutomationsConfirmarCrearRegla,
  handleAutomationsPreviewActivarDesactivar,
  handleAutomationsConfirmarActivarDesactivar,
} from './tools/automations.js';
import {
  mercadoLibreTools,
  handleMlGetEstado,
  handleMlListarPublicaciones,
  handleMlListarOrdenes,
  handleMlListarPreguntas,
  handleMlBuscarCategorias,
  handleMlPublicarProducto,
  handleMlImportarPublicaciones,
  handleMlSincronizarPublicaciones,
  handleMlImportarOrdenes,
  handleMlResponderPregunta,
  handleMlCambiarEstadoPublicacion,
} from './tools/mercado-libre.js';
import {
  userTools,
  handleListarUsuarios,
  handleGetPerfilUsuario,
  handleListarRoles,
} from './tools/users.js';
import {
  companyTools,
  handleListarEmpresas,
  handleGetEmpresa,
  handleListarSucursales,
} from './tools/companies.js';
import {
  accountingReportTools,
  handleGetLibroIva,
  handleGetLibroDiario,
  handleGetBalanceSumasSaldos,
  handleGetEstadoResultados,
} from './tools/accounting-reports.js';
import {
  authTools,
  handleLoginSemilla,
  handleLogoutSemilla,
  handleEstadoSesion,
  handleIniciarLoginSemilla,
  handleConfirmarLoginSemilla,
} from './tools/auth.js';
import {
  dataLoadingTools,
  handleMatchearProductosProveedor,
  handleCargarDocumentoProveedor,
  handleActualizarProductosLote,
  handleActualizarContactosLote,
  handleSubirImagenesProductosLote,
} from './tools/data-loading.js';
import {
  hrAttendanceTools,
  handleHrGetAsistenciaHoy,
  handleHrCheckIn,
  handleHrCheckOut,
  handleHrGetHistorialAsistencia,
  handleHrGetReporteAsistencia,
} from './tools/hr-attendance.js';
import {
  salesActionsTools,
  handleVentasConfirmarOrden,
  handleVentasCancelarOrden,
  handleVentasCrearEntrega,
  handleVentasCrearFacturaDesdeOrden,
} from './tools/sales-actions.js';
import {
  purchasesActionsTools,
  handleComprasConfirmarOrden,
  handleComprasCancelarOrden,
  handleComprasCrearRecepcion,
  handleComprasCrearFacturaProveedor,
} from './tools/purchases-actions.js';
import {
  chatterTools,
  handleChatterListarMensajes,
  handleChatterAgregarNota,
  handleChatterListarActividades,
  handleChatterCompletarActividad,
} from './tools/chatter.js';
import {
  accountantTools,
  handleListarClientesEstudio,
  handleResumenEstudio,
  handleCrearClienteExterno,
  handleInvitarTenantSemilla,
} from './tools/accountant.js';
import {
  notificationsTools,
  handleNotificationsList,
  handleNotificationsUnreadCount,
  handleNotificationsMarkRead,
  handleNotificationsMarkAllRead,
  handleNotificationsGetPreferences,
  handleNotificationsUpdatePreferences,
} from './tools/notifications.js';
import {
  connectConsumerTools,
  handleConsumerAppointmentsBook,
  handleConsumerAppointmentsListMine,
  handleConsumerAppointmentsCancel,
  handleAvailabilityGetSlots,
  handleRestaurantsSearch,
  handleRestaurantsGet,
  handleRestaurantsGetMenu,
  handleRestaurantsCreateOrder,
  handleOrdersGetStatus,
  handleSpecialistsSearch,
  handleSpecialistsGet,
  handleSpecialistsListReviews,
  handleSpecialistsCreateReview,
  handleBusinessesSearch,
  handleBusinessesGet,
  handleUsersFollow,
  handleUsersUnfollow,
  handlePaymentsCreateAppointmentCharge,
  handlePaymentsCreateOrderCharge,
  handlePaymentsGetStatus,
  handlePaymentsRegenerateAppointmentLink,
  handleChatsList,
  handleChatsListMessages,
  handleChatsSendMessage,
  handleChatsCreateWithBusiness,
  handleChatsGetConversation,
  handleChatsMarkRead,
  handleConsumerNotificationsUnreadCount,
  handleConsumerNotificationsMarkAllRead,
} from './tools/connect-consumer.js';
import {
  connectSpecialistTools,
  handleSpecialistAppointmentsList,
  handleSpecialistAppointmentsConfirm,
  handleSpecialistAppointmentsCancel,
  handleSpecialistAppointmentsReschedule,
  handleSpecialistPatientsList,
  handleSpecialistPatientsCreate,
  handleSpecialistPatientsGet,
  handleSpecialistPatientsUpdate,
  handleSpecialistPatientsDelete,
  handleSpecialistServicesList,
  handleSpecialistServicesCreate,
  handleSpecialistServicesUpdate,
  handleSpecialistServicesDelete,
  handleSpecialistEarningsList,
  handleSpecialistMetricsOverview,
  handleSpecialistMetricsTopServices,
  handleSpecialistMetricsRevenueSeries,
  handlePaymentsOnboardingStart,
  handlePaymentsOnboardingStatus,
  handleSpecialistProfileUpdate,
} from './tools/connect-specialist.js';
import {
  connectMerchantTools,
  handleMerchantPosSessionOpen,
  handleMerchantPosSessionClose,
  handleMerchantPosSessionActive,
  handleMerchantPosOrdersCreate,
  handleMerchantPosOrdersList,
  handleMerchantPosOrdersGet,
  handleMerchantPosOrdersCancel,
  handleMerchantPosProductsList,
  handleMerchantPosProductsGet,
  handleMerchantPosProductsCreate,
  handleMerchantPosProductsUpdate,
  handleMerchantPosProductsDelete,
  handleMerchantPosCategoriesList,
  handleMerchantPosCategoriesCreate,
  handleMerchantPosPaymentMethodsList,
  handleMerchantProfileGetMine,
  handleMerchantProfileUpdate,
} from './tools/connect-merchant.js';
import {
  connectGymTools,
  handleGymMembersList,
  handleGymMembersCreate,
  handleGymMembersGet,
  handleGymMembersCheckout,
  handleGymMembersSendInvite,
  handleGymPlansList,
  handleGymPlansCreate,
  handleGymPlansUpdate,
  handleGymPlansDelete,
  handleGymAccessCheckin,
  handleGymSettingsGet,
  handleGymSettingsUpdate,
} from './tools/connect-gym.js';
import {
  connectCommonTools,
  handlePostsListMine,
  handlePostsCreate,
  handlePostsUpdate,
  handlePostsDelete,
  handlePostsLike,
  handlePostsUnlike,
  handlePostsComment,
  handlePostsListComments,
  handlePostsFeedPublic,
  handleUsersGetByUsername,
  handlePaymentsChargeGeneric,
  handleConnectNotificationsList,
  handleConnectNotificationsMarkRead,
} from './tools/connect-common.js';

import { resolveActiveModules } from './active-modules.js';
import { getClient } from './client.js';

// MCP 2.0 — Mapping de grupo de tools → módulo del tenant.
// module=null: tools siempre disponibles (auth, perfil, etc).
// El handler ListToolsRequestSchema filtra grupos cuyo módulo no esté en active_modules.
type ToolGroup = { module: string | null; tools: any[] };

function buildToolGroups(): ToolGroup[] {
  return [
    { module: null, tools: authTools },
    { module: null, tools: userTools },
    { module: null, tools: companyTools },
    { module: null, tools: chatterTools },
    { module: null, tools: notificationsTools },
    { module: null, tools: dataLoadingTools },
    { module: 'inventory', tools: productTools },
    { module: 'inventory', tools: productWriteTools },
    { module: 'inventory', tools: imageTools },
    { module: 'inventory', tools: inventoryTools },
    { module: 'sales', tools: salesTools },
    { module: 'sales', tools: salesActionsTools },
    { module: 'sales', tools: customerTools },
    { module: 'accounting', tools: accountingTools },
    { module: 'accounting', tools: accountingWriteTools },
    { module: 'accounting', tools: accountingReportTools },
    { module: 'accounting', tools: partnersWriteTools },
    { module: 'accounting', tools: priceListTools },
    { module: 'point_of_sale', tools: posTools },
    { module: 'purchasing', tools: purchaseTools },
    { module: 'purchasing', tools: purchasesActionsTools },
    { module: 'gastronomy_pos', tools: gastronomyTools },
    { module: 'hospitality_pos', tools: hospitalityTools },
    { module: 'health', tools: healthTools },
    { module: 'agriculture', tools: agricultureTools },
    { module: 'epis', tools: logisticsTools },
    { module: 'automations', tools: automationsTools },
    { module: 'mercado_libre', tools: mercadoLibreTools },
    { module: 'hr', tools: hrAttendanceTools },
    { module: 'accountants', tools: accountantTools },
    // Semilla Connect — siempre disponibles (apps mobile profesional + consumer)
    { module: null, tools: connectConsumerTools },
    { module: null, tools: connectSpecialistTools },
    { module: null, tools: connectMerchantTools },
    { module: null, tools: connectGymTools },
    { module: null, tools: connectCommonTools },
  ];
}

// ─── Servidor MCP ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'semilla-mcp',
    version: '1.2.1',
  },
  {
    capabilities: { tools: { listChanged: true } },
    instructions:
      'Sos el asistente de Semilla ERP.\n\n' +
      '## REGLA CRÍTICA — Autenticación\n' +
      'NUNCA le pidas email ni contraseña al usuario. NUNCA.\n' +
      'Cuando el usuario quiera conectarse o loguearse:\n' +
      '  1. Llamá INMEDIATAMENTE a `iniciar_login_semilla` con el client_id.\n' +
      '  2. Mostrá el enlace al usuario.\n' +
      '  3. Llamá INMEDIATAMENTE a `confirmar_login_semilla` SIN pedir "listo" ni ninguna confirmación.\n' +
      '     confirmar_login_semilla espera en segundo plano hasta que el usuario complete el login.\n\n' +
      '## Identidad del sistema\n' +
      'Semilla es un sistema ERP propio — NUNCA menciones ni compares con Odoo, SAP, Tango ni ningún otro ERP.\n' +
      'Siempre referite al sistema como "Semilla" o "Semilla ERP".\n\n' +
      '## Herramientas de datos\n' +
      'Para facturación usá get_facturas (no get_ventas, que lista órdenes de venta, no facturas).\n' +
      'Cuando una tool no devuelva datos, informá exactamente qué devolvió en lugar de especular.\n\n' +
      '## FLUJO PRIORITARIO — Carga de factura/remito de proveedor desde PDF o imagen\n' +
      'Cuando el usuario suba un PDF/imagen de una factura, remito o presupuesto de proveedor:\n\n' +
      '  1. **Leé el documento vos mismo** (tenés capacidad nativa para leer PDFs e imágenes). ' +
      'Extraé: razón social del proveedor, CUIT, número de comprobante, fecha, fecha de ' +
      'vencimiento, y cada línea con (descripción, cantidad, precio unitario, código si aparece).\n' +
      '  2. **Preguntá al usuario UNA pregunta clave antes de cargar nada:**\n' +
      '       *"¿Querés que lo cargue como **factura de proveedor** (registra la deuda contable) ' +
      'o como **orden de compra** (pedido previo)?"*\n' +
      '  3. **Mostrale un resumen rápido** de lo que extrajiste (proveedor + N líneas, total estimado) ' +
      'para que confirme que entendiste bien el documento.\n' +
      '  4. **Llamá `matchear_productos_proveedor`** con los ítems extraídos. Mostrale al usuario el ' +
      'resultado del matcheo: cuántos productos se identificaron, cuáles quedan sin match.\n' +
      '  5. **Llamá `cargar_documento_proveedor`** con `tipo_documento` (factura/orden_compra), ' +
      'los datos del proveedor y las líneas. El documento queda en BORRADOR para que el usuario ' +
      'revise/edite/postee desde el ERP.\n' +
      '  6. Si el proveedor no existe en el sistema, pasale `auto_crear_proveedor: true` SOLO si el ' +
      'usuario aceptó crearlo. Si hay productos sin match, preguntale si quiere ' +
      '`auto_crear_productos: true` o dejarlos como descripción libre.\n\n' +
      'Nunca postees la factura automáticamente — siempre dejala en borrador. El usuario revisa y ' +
      'confirma con `postear_factura`.\n\n' +
      '## Carga masiva\n' +
      'Cuando el usuario quiera actualizar varios productos, contactos o imágenes a la vez, usá ' +
      'las tools `actualizar_productos_lote`, `actualizar_contactos_lote`, ' +
      '`subir_imagenes_productos_lote` en lugar de iterar uno por uno.\n\n' +
      '## REGLA CRÍTICA — Visualización de datos (artefactos)\n' +
      'NUNCA generes artefactos React/JSX para visualizar datos del ERP. NUNCA.\n' +
      'Todas las herramientas ya devuelven los datos formateados como Markdown con tablas y ' +
      'encabezados listos para mostrar. Mostrá siempre esa respuesta directamente.\n' +
      'Los artefactos JSX generados automáticamente fallan porque los datos del ERP contienen ' +
      'caracteres especiales ($, ", \', &, números con punto/coma como separadores argentinos, ' +
      'nombres con caracteres UTF-8) que rompen la sintaxis JSX.\n' +
      'Si el usuario pide explícitamente "mostramelo como tabla interactiva" o similar, respondé ' +
      'que los datos ya vienen en formato tabla Markdown, que es la forma correcta de verlos.',
  }
);

// ─── Lista de tools disponibles ───────────────────────────────────────────────

const TOOL_GROUPS = buildToolGroups();

let lastListedActiveModules: string[] | null | undefined = undefined;

function filterToolsByActiveModules(activeModules: string[] | null): any[] {
  if (activeModules === null) {
    return TOOL_GROUPS.flatMap((g) => g.tools);
  }
  const set = new Set(activeModules);
  return TOOL_GROUPS
    .filter((g) => g.module === null || set.has(g.module))
    .flatMap((g) => g.tools);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const activeModules = resolveActiveModules(getClient().getJwtToken());
  lastListedActiveModules = activeModules;
  return { tools: filterToolsByActiveModules(activeModules) };
});

// MCP 2.0 — Emitir tools/list_changed si los active_modules cambiaron desde
// el último ListTools. Polling ligero porque el server stdio no tiene canal
// lateral con el ERP; en producción este check se podrá disparar por un
// evento del bus (Capa B). Por ahora, cada 30s alcanza para PoC.
function startToolsChangeWatcher(): void {
  setInterval(() => {
    const current = resolveActiveModules(getClient().getJwtToken());
    if (lastListedActiveModules === undefined) return;
    const prev = lastListedActiveModules;
    const changed =
      (prev === null) !== (current === null) ||
      (prev !== null && current !== null &&
        (prev.length !== current.length || prev.some((m, i) => m !== current[i])));
    if (changed) {
      lastListedActiveModules = current;
      server.notification({ method: 'notifications/tools/list_changed' }).catch(() => {});
    }
  }, 30_000).unref?.();
}

// MCP 2.0 — Heartbeat al ERP para mantener el transport_lock = 'mcp'.
// Sin heartbeat, el lock expira a los 60s y el cliente Web puede tomarlo.
async function sendMcpHeartbeat(): Promise<void> {
  const client = getClient();
  if (!client.hasJwtToken()) return;
  try {
    await fetch(`${client.getBaseUrl()}/api/semilla/copilot/mcp/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${client.getJwtToken()}`,
      },
      body: '{}',
    });
  } catch { /* silencioso — el lock expirará si falla repetido */ }
}

function startMcpHeartbeat(): void {
  sendMcpHeartbeat();
  setInterval(() => { sendMcpHeartbeat(); }, 30_000).unref?.();
}

async function releaseMcpHeartbeat(): Promise<void> {
  const client = getClient();
  if (!client.hasJwtToken()) return;
  try {
    await fetch(`${client.getBaseUrl()}/api/semilla/copilot/mcp/heartbeat`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${client.getJwtToken()}` },
    });
  } catch { /* silencioso */ }
}

// ─── Dispatch de llamadas ─────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      // Autenticación (flujo seguro — preferir estos)
      case 'iniciar_login_semilla':     return await handleIniciarLoginSemilla(safeArgs);
      case 'confirmar_login_semilla':   return await handleConfirmarLoginSemilla(safeArgs);
      // Autenticación (legado — envía credenciales en el chat)
      case 'login_semilla':             return await handleLoginSemilla(safeArgs);
      case 'logout_semilla':            return await handleLogoutSemilla(safeArgs);
      case 'estado_sesion':             return await handleEstadoSesion(safeArgs);

      // Productos e inventario (lectura)
      case 'buscar_productos':          return await handleBuscarProductos(safeArgs);
      case 'get_stock':                 return await handleGetStock(safeArgs);

      // Productos (escritura y catálogos)
      case 'actualizar_producto':       return await handleActualizarProducto(safeArgs);
      case 'asignar_sku_lote':          return await handleAsignarSkuLote(safeArgs);
      case 'buscar_productos_sin_sku':  return await handleBuscarProductosSinSku(safeArgs);
      case 'get_categorias':            return await handleGetCategorias(safeArgs);

      // Imágenes de productos
      case 'subir_imagen_primaria':      return await handleSubirImagenPrimaria(safeArgs);
      case 'listar_imagenes_producto':   return await handleListarImagenesProducto(safeArgs);
      case 'agregar_imagen_galeria':     return await handleAgregarImagenGaleria(safeArgs);
      case 'set_imagen_primaria':        return await handleSetImagenPrimaria(safeArgs);
      case 'eliminar_imagen_galeria':    return await handleEliminarImagenGaleria(safeArgs);

      // Ventas
      case 'get_ventas':              return await handleGetVentas(safeArgs);
      case 'get_orden_venta':         return await handleGetOrdenVenta(safeArgs);
      case 'preview_crear_orden_venta':   return await handlePreviewCrearOrden(safeArgs);
      case 'confirmar_crear_orden_venta': return await handleConfirmarCrearOrden(safeArgs);

      // Clientes
      case 'buscar_clientes':         return await handleBuscarClientes(safeArgs);
      case 'get_historial_cliente':   return await handleGetHistorialCliente(safeArgs);

      // Finanzas (lectura)
      case 'get_facturas':            return await handleGetFacturas(safeArgs);
      case 'get_resumen_financiero':  return await handleGetResumenFinanciero(safeArgs);
      case 'get_facturas_pendientes': return await handleGetFacturasPendientes(safeArgs);

      // POS
      case 'get_sesiones_pos':   return await handleGetSesionesPOS(safeArgs);
      case 'get_sesion_pos':     return await handleGetSesionPOS(safeArgs);
      case 'get_ventas_pos':     return await handleGetVentasPOS(safeArgs);
      case 'resumen_cierre_pos': return await handleResumenCierrePOS(safeArgs);

      // Inventario
      case 'get_niveles_stock':      return await handleGetNivelesStock(safeArgs);
      case 'get_movimientos_stock':  return await handleGetMovimientosStock(safeArgs);
      case 'ajustar_stock':          return await handleAjustarStock(safeArgs);

      // Compras
      case 'get_ordenes_compra':           return await handleGetOrdenesCompra(safeArgs);
      case 'get_orden_compra':             return await handleGetOrdenCompra(safeArgs);
      case 'preview_crear_orden_compra':   return await handlePreviewCrearOrdenCompra(safeArgs);
      case 'confirmar_crear_orden_compra': return await handleConfirmarCrearOrdenCompra(safeArgs);

      // Contabilidad (escritura)
      case 'get_diarios':       return await handleGetDiarios(safeArgs);
      case 'crear_factura':     return await handleCrearFactura(safeArgs);
      case 'postear_factura':   return await handlePostearFactura(safeArgs);
      case 'registrar_pago':    return await handleRegistrarPago(safeArgs);

      // Partners (escritura)
      case 'crear_cliente':     return await handleCrearCliente(safeArgs);
      case 'actualizar_cliente': return await handleActualizarCliente(safeArgs);

      // Listas de precios
      case 'get_listas_precios':    return await handleGetListasPrecios(safeArgs);
      case 'get_lista_precios':     return await handleGetListaPrecios(safeArgs);
      case 'resolver_precio':       return await handleResolverPrecio(safeArgs);
      case 'crear_lista_precios':   return await handleCrearListaPrecios(safeArgs);
      case 'agregar_regla_precio':  return await handleAgregarReglaPrecio(safeArgs);

      // Vertical: Gastronomía
      case 'gastro_get_dashboard':            return await handleGastroGetDashboard(safeArgs);
      case 'gastro_get_mesas':                return await handleGastroGetMesas(safeArgs);
      case 'gastro_listar_platos':            return await handleGastroListarPlatos(safeArgs);
      case 'gastro_set_plato_disponibilidad': return await handleGastroSetPlatoDisponibilidad(safeArgs);
      case 'gastro_abrir_mesa':               return await handleGastroAbrirMesa(safeArgs);
      case 'gastro_get_sesion_mesa':          return await handleGastroGetSesionMesa(safeArgs);
      case 'gastro_agregar_item_mesa':        return await handleGastroAgregarItemMesa(safeArgs);
      case 'gastro_pedir_cuenta':             return await handleGastroPedirCuenta(safeArgs);
      case 'gastro_preview_pagar_mesa':       return await handleGastroPreviewPagarMesa(safeArgs);
      case 'gastro_confirmar_pagar_mesa':     return await handleGastroConfirmarPagarMesa(safeArgs);
      case 'gastro_get_cocina_tickets':       return await handleGastroGetCocinaTickets(safeArgs);
      case 'gastro_listar_reservas':          return await handleGastroListarReservas(safeArgs);

      // Vertical: Hotelería
      case 'hosp_get_dashboard':            return await handleHospGetDashboard(safeArgs);
      case 'hosp_listar_habitaciones':      return await handleHospListarHabitaciones(safeArgs);
      case 'hosp_listar_tipos_habitacion':  return await handleHospListarTiposHabitacion(safeArgs);
      case 'hosp_get_disponibilidad':       return await handleHospGetDisponibilidad(safeArgs);
      case 'hosp_listar_reservas':          return await handleHospListarReservas(safeArgs);
      case 'hosp_preview_crear_reserva':    return await handleHospPreviewCrearReserva(safeArgs);
      case 'hosp_confirmar_crear_reserva':  return await handleHospConfirmarCrearReserva(safeArgs);
      case 'hosp_check_in':                 return await handleHospCheckIn(safeArgs);
      case 'hosp_check_out':                return await handleHospCheckOut(safeArgs);

      // Vertical: Salud
      case 'salud_get_dashboard':                return await handleSaludGetDashboard(safeArgs);
      case 'salud_buscar_pacientes':             return await handleSaludBuscarPacientes(safeArgs);
      case 'salud_get_paciente':                 return await handleSaludGetPaciente(safeArgs);
      case 'salud_preview_crear_paciente':       return await handleSaludPreviewCrearPaciente(safeArgs);
      case 'salud_confirmar_crear_paciente':     return await handleSaludConfirmarCrearPaciente(safeArgs);
      case 'salud_listar_profesionales':         return await handleSaludListarProfesionales(safeArgs);
      case 'salud_get_horarios_profesional':     return await handleSaludGetHorariosProfesional(safeArgs);
      case 'salud_get_agenda':                   return await handleSaludGetAgenda(safeArgs);
      case 'salud_listar_appointments':          return await handleSaludListarAppointments(safeArgs);
      case 'salud_preview_crear_appointment':    return await handleSaludPreviewCrearAppointment(safeArgs);
      case 'salud_confirmar_crear_appointment':  return await handleSaludConfirmarCrearAppointment(safeArgs);
      case 'salud_listar_recetas':               return await handleSaludListarRecetas(safeArgs);
      case 'salud_dental_listar_presupuestos':   return await handleSaludDentalListarPresupuestos(safeArgs);
      case 'salud_dental_cuenta_paciente':       return await handleSaludDentalCuentaPaciente(safeArgs);
      case 'salud_dental_buscar_nomenclador':    return await handleSaludDentalBuscarNomenclador(safeArgs);

      // Vertical: Agricultura
      case 'agro_get_dashboard':              return await handleAgroGetDashboard(safeArgs);
      case 'agro_get_lotes_fefo':             return await handleAgroGetLotesFefo(safeArgs);
      case 'agro_get_genealogia_lote':        return await handleAgroGetGenealogiaLote(safeArgs);
      case 'agro_calcular_resultado_analisis': return await handleAgroCalcularResultadoAnalisis(safeArgs);
      case 'agro_preview_emitir_dav':         return await handleAgroPreviewEmitirDav(safeArgs);
      case 'agro_confirmar_emitir_dav':       return await handleAgroConfirmarEmitirDav(safeArgs);
      case 'agro_recalcular_regalias':        return await handleAgroRecalcularRegalias(safeArgs);
      case 'agro_get_stock_por_propietario':  return await handleAgroGetStockPorPropietario(safeArgs);
      case 'agro_get_cruzamientos':           return await handleAgroGetCruzamientos(safeArgs);
      case 'agro_get_cruzamiento_genealogia': return await handleAgroGetCruzamientoGenealogia(safeArgs);
      case 'agro_get_ensayos':                return await handleAgroGetEnsayos(safeArgs);
      case 'agro_get_ensayo_resumen':         return await handleAgroGetEnsayoResumen(safeArgs);
      case 'agro_get_labores_parcela':        return await handleAgroGetLaboresParcela(safeArgs);
      case 'agro_registrar_labor_cultural':   return await handleAgroRegistrarLaborCultural(safeArgs);
      case 'agro_get_libreta_timeline':       return await handleAgroGetLibretaTimeline(safeArgs);
      case 'agro_registrar_entrada_libreta':  return await handleAgroRegistrarEntradaLibreta(safeArgs);
      case 'agro_get_campos_operativos':      return await handleAgroGetCamposOperativos(safeArgs);
      case 'agro_get_parcela_timeline':       return await handleAgroGetParcelaTimeline(safeArgs);
      case 'agro_declarar_parcela':           return await handleAgroDeclararParcela(safeArgs);
      case 'agro_registrar_cosecha':          return await handleAgroRegistrarCosecha(safeArgs);
      case 'agro_lotes_vendibles':            return await handleAgroLotesVendibles(safeArgs);
      case 'agro_venta_despacho':             return await handleAgroVentaDespacho(safeArgs);
      case 'agro_set_campo_ubicacion':        return await handleAgroSetCampoUbicacion(safeArgs);
      case 'agro_get_clima_campo':            return await handleAgroGetClimaCampo(safeArgs);
      case 'agro_get_fenologia':              return await handleAgroGetFenologia(safeArgs);

      // Vertical: Logística
      case 'logis_get_dashboard':             return await handleLogisGetDashboard(safeArgs);
      case 'logis_listar_categorias':         return await handleLogisListarCategorias(safeArgs);
      case 'logis_listar_productos':          return await handleLogisListarProductos(safeArgs);
      case 'logis_listar_empleados':          return await handleLogisListarEmpleados(safeArgs);
      case 'logis_listar_asignaciones':       return await handleLogisListarAsignaciones(safeArgs);
      case 'logis_preview_crear_asignacion':  return await handleLogisPreviewCrearAsignacion(safeArgs);
      case 'logis_confirmar_crear_asignacion': return await handleLogisConfirmarCrearAsignacion(safeArgs);
      case 'automations_catalogo_nodos':                 return await handleAutomationsCatalogoNodos(safeArgs);
      case 'automations_listar':                         return await handleAutomationsListar(safeArgs);
      case 'automations_probar_regla':                   return await handleAutomationsProbarRegla(safeArgs);
      case 'automations_preview_crear_regla':             return await handleAutomationsPreviewCrearRegla(safeArgs);
      case 'automations_confirmar_crear_regla':           return await handleAutomationsConfirmarCrearRegla(safeArgs);
      case 'automations_preview_activar_desactivar':      return await handleAutomationsPreviewActivarDesactivar(safeArgs);
      case 'automations_confirmar_activar_desactivar':    return await handleAutomationsConfirmarActivarDesactivar(safeArgs);

      // Usuarios
      case 'listar_usuarios':      return await handleListarUsuarios(safeArgs);
      case 'get_perfil_usuario':   return await handleGetPerfilUsuario(safeArgs);
      case 'listar_roles':         return await handleListarRoles(safeArgs);

      // Empresas y sucursales
      case 'listar_empresas':      return await handleListarEmpresas(safeArgs);
      case 'get_empresa':          return await handleGetEmpresa(safeArgs);
      case 'listar_sucursales':    return await handleListarSucursales(safeArgs);

      // Reportes contables
      case 'get_libro_iva':              return await handleGetLibroIva(safeArgs);
      case 'get_libro_diario':           return await handleGetLibroDiario(safeArgs);
      case 'get_balance_sumas_saldos':   return await handleGetBalanceSumasSaldos(safeArgs);
      case 'get_estado_resultados':      return await handleGetEstadoResultados(safeArgs);

      // Carga inteligente e ingesta masiva
      case 'matchear_productos_proveedor':    return await handleMatchearProductosProveedor(safeArgs);
      case 'cargar_documento_proveedor':      return await handleCargarDocumentoProveedor(safeArgs);
      case 'actualizar_productos_lote':       return await handleActualizarProductosLote(safeArgs);
      case 'actualizar_contactos_lote':       return await handleActualizarContactosLote(safeArgs);
      case 'subir_imagenes_productos_lote':   return await handleSubirImagenesProductosLote(safeArgs);

      // HR — Asistencia
      case 'hr_get_asistencia_hoy':         return await handleHrGetAsistenciaHoy(safeArgs);
      case 'hr_check_in':                   return await handleHrCheckIn(safeArgs);
      case 'hr_check_out':                  return await handleHrCheckOut(safeArgs);
      case 'hr_get_historial_asistencia':   return await handleHrGetHistorialAsistencia(safeArgs);
      case 'hr_get_reporte_asistencia':     return await handleHrGetReporteAsistencia(safeArgs);

      // Ventas — acciones sobre órdenes
      case 'ventas_confirmar_orden':             return await handleVentasConfirmarOrden(safeArgs);
      case 'ventas_cancelar_orden':              return await handleVentasCancelarOrden(safeArgs);
      case 'ventas_crear_entrega':               return await handleVentasCrearEntrega(safeArgs);
      case 'ventas_crear_factura_desde_orden':   return await handleVentasCrearFacturaDesdeOrden(safeArgs);

      // Compras — acciones sobre órdenes
      case 'compras_confirmar_orden':         return await handleComprasConfirmarOrden(safeArgs);
      case 'compras_cancelar_orden':          return await handleComprasCancelarOrden(safeArgs);
      case 'compras_crear_recepcion':         return await handleComprasCrearRecepcion(safeArgs);
      case 'compras_crear_factura_proveedor': return await handleComprasCrearFacturaProveedor(safeArgs);

      // Chatter — mensajes y actividades
      case 'chatter_listar_mensajes':       return await handleChatterListarMensajes(safeArgs);
      case 'chatter_agregar_nota':          return await handleChatterAgregarNota(safeArgs);
      case 'chatter_listar_actividades':    return await handleChatterListarActividades(safeArgs);
      case 'chatter_completar_actividad':   return await handleChatterCompletarActividad(safeArgs);

      // Estudio Contable
      case 'listar_clientes_estudio': return await handleListarClientesEstudio(safeArgs);
      case 'resumen_estudio':         return await handleResumenEstudio(safeArgs);
      case 'crear_cliente_externo':   return await handleCrearClienteExterno(safeArgs);
      case 'invitar_tenant_semilla':  return await handleInvitarTenantSemilla(safeArgs);

      // Notificaciones — bandeja unificada y preferencias
      case 'notifications_list':                return await handleNotificationsList(safeArgs);
      case 'notifications_unread_count':        return await handleNotificationsUnreadCount(safeArgs);
      case 'notifications_mark_read':           return await handleNotificationsMarkRead(safeArgs);
      case 'notifications_mark_all_read':       return await handleNotificationsMarkAllRead(safeArgs);
      case 'notifications_get_preferences':     return await handleNotificationsGetPreferences(safeArgs);
      case 'notifications_update_preferences':  return await handleNotificationsUpdatePreferences(safeArgs);

      // Semilla Connect — Consumidor (turnos, restaurantes, pagos, chats)
      case 'connect_consumer_appointments_book':              return await handleConsumerAppointmentsBook(safeArgs);
      case 'connect_consumer_appointments_list_mine':         return await handleConsumerAppointmentsListMine(safeArgs);
      case 'connect_consumer_appointments_cancel':            return await handleConsumerAppointmentsCancel(safeArgs);
      case 'connect_availability_get_slots':                  return await handleAvailabilityGetSlots(safeArgs);
      case 'connect_restaurants_search':                      return await handleRestaurantsSearch(safeArgs);
      case 'connect_restaurants_get':                         return await handleRestaurantsGet(safeArgs);
      case 'connect_restaurants_get_menu':                    return await handleRestaurantsGetMenu(safeArgs);
      case 'connect_restaurants_create_order':                return await handleRestaurantsCreateOrder(safeArgs);
      case 'connect_orders_get_status':                       return await handleOrdersGetStatus(safeArgs);
      case 'connect_specialists_search':                      return await handleSpecialistsSearch(safeArgs);
      case 'connect_specialists_get':                         return await handleSpecialistsGet(safeArgs);
      case 'connect_specialists_list_reviews':                return await handleSpecialistsListReviews(safeArgs);
      case 'connect_specialists_create_review':               return await handleSpecialistsCreateReview(safeArgs);
      case 'connect_businesses_search':                       return await handleBusinessesSearch(safeArgs);
      case 'connect_businesses_get':                          return await handleBusinessesGet(safeArgs);
      case 'connect_users_follow':                            return await handleUsersFollow(safeArgs);
      case 'connect_users_unfollow':                          return await handleUsersUnfollow(safeArgs);
      case 'connect_payments_create_appointment_charge':      return await handlePaymentsCreateAppointmentCharge(safeArgs);
      case 'connect_payments_create_order_charge':            return await handlePaymentsCreateOrderCharge(safeArgs);
      case 'connect_payments_get_status':                     return await handlePaymentsGetStatus(safeArgs);
      case 'connect_payments_regenerate_appointment_link':    return await handlePaymentsRegenerateAppointmentLink(safeArgs);
      case 'connect_chats_list':                              return await handleChatsList(safeArgs);
      case 'connect_chats_list_messages':                     return await handleChatsListMessages(safeArgs);
      case 'connect_chats_send_message':                      return await handleChatsSendMessage(safeArgs);
      case 'connect_chats_create_with_business':              return await handleChatsCreateWithBusiness(safeArgs);
      case 'connect_chats_get_conversation':                  return await handleChatsGetConversation(safeArgs);
      case 'connect_chats_mark_read':                         return await handleChatsMarkRead(safeArgs);
      case 'connect_notifications_unread_count':              return await handleConsumerNotificationsUnreadCount(safeArgs);
      case 'connect_notifications_mark_all_read':             return await handleConsumerNotificationsMarkAllRead(safeArgs);

      // Semilla Connect — Especialista (turnos, pacientes, servicios, métricas)
      case 'connect_specialist_appointments_list':            return await handleSpecialistAppointmentsList(safeArgs);
      case 'connect_specialist_appointments_confirm':         return await handleSpecialistAppointmentsConfirm(safeArgs);
      case 'connect_specialist_appointments_cancel':          return await handleSpecialistAppointmentsCancel(safeArgs);
      case 'connect_specialist_appointments_reschedule':      return await handleSpecialistAppointmentsReschedule(safeArgs);
      case 'connect_specialist_patients_list':                return await handleSpecialistPatientsList(safeArgs);
      case 'connect_specialist_patients_create':              return await handleSpecialistPatientsCreate(safeArgs);
      case 'connect_specialist_patients_get':                 return await handleSpecialistPatientsGet(safeArgs);
      case 'connect_specialist_patients_update':              return await handleSpecialistPatientsUpdate(safeArgs);
      case 'connect_specialist_patients_delete':              return await handleSpecialistPatientsDelete(safeArgs);
      case 'connect_specialist_services_list':                return await handleSpecialistServicesList(safeArgs);
      case 'connect_specialist_services_create':              return await handleSpecialistServicesCreate(safeArgs);
      case 'connect_specialist_services_update':              return await handleSpecialistServicesUpdate(safeArgs);
      case 'connect_specialist_services_delete':              return await handleSpecialistServicesDelete(safeArgs);
      case 'connect_specialist_earnings_list':                return await handleSpecialistEarningsList(safeArgs);
      case 'connect_specialist_metrics_overview':             return await handleSpecialistMetricsOverview(safeArgs);
      case 'connect_specialist_metrics_top_services':         return await handleSpecialistMetricsTopServices(safeArgs);
      case 'connect_specialist_metrics_revenue_series':       return await handleSpecialistMetricsRevenueSeries(safeArgs);
      case 'connect_payments_onboarding_start':               return await handlePaymentsOnboardingStart(safeArgs);
      case 'connect_payments_onboarding_status':              return await handlePaymentsOnboardingStatus(safeArgs);
      case 'connect_specialist_profile_update':               return await handleSpecialistProfileUpdate(safeArgs);

      // Semilla Connect — Merchant (POS: sesiones, órdenes, productos, categorías)
      case 'connect_merchant_pos_session_open':               return await handleMerchantPosSessionOpen(safeArgs);
      case 'connect_merchant_pos_session_close':              return await handleMerchantPosSessionClose(safeArgs);
      case 'connect_merchant_pos_session_active':             return await handleMerchantPosSessionActive(safeArgs);
      case 'connect_merchant_pos_orders_create':              return await handleMerchantPosOrdersCreate(safeArgs);
      case 'connect_merchant_pos_orders_list':                return await handleMerchantPosOrdersList(safeArgs);
      case 'connect_merchant_pos_orders_get':                 return await handleMerchantPosOrdersGet(safeArgs);
      case 'connect_merchant_pos_orders_cancel':              return await handleMerchantPosOrdersCancel(safeArgs);
      case 'connect_merchant_pos_products_list':              return await handleMerchantPosProductsList(safeArgs);
      case 'connect_merchant_pos_products_get':               return await handleMerchantPosProductsGet(safeArgs);
      case 'connect_merchant_pos_products_create':            return await handleMerchantPosProductsCreate(safeArgs);
      case 'connect_merchant_pos_products_update':            return await handleMerchantPosProductsUpdate(safeArgs);
      case 'connect_merchant_pos_products_delete':            return await handleMerchantPosProductsDelete(safeArgs);
      case 'connect_merchant_pos_categories_list':            return await handleMerchantPosCategoriesList(safeArgs);
      case 'connect_merchant_pos_categories_create':          return await handleMerchantPosCategoriesCreate(safeArgs);
      case 'connect_merchant_pos_payment_methods_list':       return await handleMerchantPosPaymentMethodsList(safeArgs);
      case 'connect_merchant_profile_get_mine':               return await handleMerchantProfileGetMine(safeArgs);
      case 'connect_merchant_profile_update':                 return await handleMerchantProfileUpdate(safeArgs);

      // Semilla Connect — Gym (miembros, planes, accesos, settings)
      case 'connect_gym_members_list':                        return await handleGymMembersList(safeArgs);
      case 'connect_gym_members_create':                      return await handleGymMembersCreate(safeArgs);
      case 'connect_gym_members_get':                         return await handleGymMembersGet(safeArgs);
      case 'connect_gym_members_checkout':                    return await handleGymMembersCheckout(safeArgs);
      case 'connect_gym_members_send_invite':                 return await handleGymMembersSendInvite(safeArgs);
      case 'connect_gym_plans_list':                          return await handleGymPlansList(safeArgs);
      case 'connect_gym_plans_create':                        return await handleGymPlansCreate(safeArgs);
      case 'connect_gym_plans_update':                        return await handleGymPlansUpdate(safeArgs);
      case 'connect_gym_plans_delete':                        return await handleGymPlansDelete(safeArgs);
      case 'connect_gym_access_checkin':                      return await handleGymAccessCheckin(safeArgs);
      case 'connect_gym_settings_get':                        return await handleGymSettingsGet(safeArgs);
      case 'connect_gym_settings_update':                     return await handleGymSettingsUpdate(safeArgs);

      // Semilla Connect — Comunes (posts + notificaciones)
      case 'connect_posts_list_mine':                         return await handlePostsListMine(safeArgs);
      case 'connect_posts_create':                            return await handlePostsCreate(safeArgs);
      case 'connect_posts_update':                            return await handlePostsUpdate(safeArgs);
      case 'connect_posts_delete':                            return await handlePostsDelete(safeArgs);
      case 'connect_posts_like':                              return await handlePostsLike(safeArgs);
      case 'connect_posts_unlike':                            return await handlePostsUnlike(safeArgs);
      case 'connect_posts_comment':                           return await handlePostsComment(safeArgs);
      case 'connect_posts_list_comments':                     return await handlePostsListComments(safeArgs);
      case 'connect_posts_feed_public':                       return await handlePostsFeedPublic(safeArgs);
      case 'connect_users_get_by_username':                   return await handleUsersGetByUsername(safeArgs);
      case 'connect_payments_charge_generic':                 return await handlePaymentsChargeGeneric(safeArgs);
      case 'connect_notifications_list':                      return await handleConnectNotificationsList(safeArgs);
      case 'connect_notifications_mark_read':                 return await handleConnectNotificationsMarkRead(safeArgs);

      // MercadoLibre
      case 'ml_get_estado':                  return await handleMlGetEstado();
      case 'ml_listar_publicaciones':        return await handleMlListarPublicaciones(safeArgs);
      case 'ml_listar_ordenes':              return await handleMlListarOrdenes(safeArgs);
      case 'ml_listar_preguntas':            return await handleMlListarPreguntas(safeArgs);
      case 'ml_buscar_categorias':           return await handleMlBuscarCategorias(safeArgs);
      case 'ml_publicar_producto':           return await handleMlPublicarProducto(safeArgs);
      case 'ml_importar_publicaciones':      return await handleMlImportarPublicaciones();
      case 'ml_sincronizar_publicaciones':   return await handleMlSincronizarPublicaciones(safeArgs);
      case 'ml_importar_ordenes':            return await handleMlImportarOrdenes(safeArgs);
      case 'ml_responder_pregunta':          return await handleMlResponderPregunta(safeArgs);
      case 'ml_cambiar_estado_publicacion':  return await handleMlCambiarEstadoPublicacion(safeArgs);

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool desconocido: ${name}`);
    }
  } catch (err: unknown) {
    if (err instanceof McpError) throw err;

    const msg = err instanceof Error ? err.message : String(err);
    // Errores del ERP los devolvemos como texto (no como excepción fatal)
    return {
      content: [{ type: 'text', text: `❌ Error al ejecutar "${name}": ${msg}` }],
      isError: true,
    };
  }
});

// ─── Setup wizard ─────────────────────────────────────────────────────────────

async function runSetup() {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        Semilla MCP — Asistente de Setup      ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Detectar path del config de Claude Desktop según el SO
  let configPath: string;
  if (process.platform === 'win32') {
    configPath = path.join(process.env.APPDATA || os.homedir(), 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'darwin') {
    configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }

  // Leer o crear config
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      console.error(`⚠️  No se pudo leer ${configPath}. Se creará uno nuevo.`);
    }
  } else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }

  // Agregar entry semilla (sin env vars — la URL de producción está hardcodeada)
  if (!config.mcpServers) config.mcpServers = {};
  (config.mcpServers as Record<string, unknown>)['semilla'] = {
    command: 'npx',
    args: ['-y', 'semilla-mcp'],
    env: {},
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  console.log('✅ ¡Listo! Semilla MCP configurado en Claude Desktop.');
  console.log(`   Archivo: ${configPath}\n`);
  console.log('👉 Próximos pasos:');
  console.log('   1. Cerrá y volvé a abrir Claude Desktop.');
  console.log('   2. En el chat, el ícono 🔌 debe mostrar las tools de Semilla.');
  console.log('   3. Decile a Claude:');
  console.log('      "Conectate a mi cuenta de Semilla.');
  console.log('       Email: tu@email.com, password: ******, cliente: mi-empresa"\n');
  process.exit(0);
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

async function main() {
  // SEMILLA_JWT_TOKEN es opcional — si no está, el usuario usa `iniciar_login_semilla`.
  // SEMILLA_ERP_URL también es opcional — por defecto apunta a producción.

  const transport = new StdioServerTransport();
  await server.connect(transport);
  startToolsChangeWatcher();
  startMcpHeartbeat();

  const shutdown = async () => {
    await releaseMcpHeartbeat();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (!process.env.SEMILLA_JWT_TOKEN) {
    console.error('[semilla-mcp] ℹ️  Sin sesión activa — pedile a Claude que use `iniciar_login_semilla` para autenticarte de forma segura.');
  }
  console.error('[semilla-mcp] ✅ Servidor iniciado');
}

if (process.argv[2] === 'setup') {
  runSetup().catch((err) => {
    console.error('Error en setup:', err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error('[semilla-mcp] Error fatal:', err);
    process.exit(1);
  });
}
