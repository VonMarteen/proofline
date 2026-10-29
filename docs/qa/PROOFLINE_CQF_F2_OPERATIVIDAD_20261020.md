# PROOFLINE Control — CQF-F2 Operatividad administrativa
Fecha: 20/10/2026 · Base: CQF-F1 validada por el usuario.

## Alcance real implementado

1. **Alta interna de oportunidad**. Nueva pantalla `/[locale]/sales/new`, disponible solo para Owner/Operations. API `POST /v1/control/sales/internal` con validación de servidor, cifrado del email, blind index para búsquedas, detección de oportunidad abierta duplicada, validación del plan, escritura transaccional y evento `COMMERCIAL_OPPORTUNITY_CREATED`. Estado `NEW`, cobro `NOT_CONFIGURED`, origen `control` en auditoría y **sin crear un Lead público ni evidencias ficticias de consentimiento**. Tras el alta, la pantalla vuelve al pipeline filtrada por el ID persistido.
2. **Detalle de comunicaciones**. Rutas `/[locale]/communications/deliveries/[id]` y `/[locale]/communications/outbox/[id]` leen registros reales de la API con permiso `communications.read`. Exponen estado, fechas, intentos, plantilla y marcadores de errores, pero **no** destinatarios técnicos privados, OTP, payload, resultado ni errores sin sanear del Outbox. No se añade botón de reenvío sin idempotencia comprobable.
3. **Terminología de Assessments**. Los estados son **actuales** (`pendientes`, `en curso`, `completados`, `revocados`), no recuentos históricos de invitaciones. No se modifica scoring ni datos.

## Protección de funcionalidad existente

- El parche parte de los mismos bytes que el ZIP CQF-F1 entregado para todos sus archivos.
- No se cambian Marketplace, Legal & Trust, Seguridad, barra lateral, scrollbars, KPI, pagos, scoring, retención, Prisma, infra ni reglas RBAC.
- Se conservan los endpoints y acciones actuales de ventas; se añaden rutas independientes y una entrada en Ventas.
- Todas las consultas nuevas están protegidas con capacidades backend.

## Validaciones realizadas en este entorno

- 120/120 pruebas automatizadas ejecutables del árbol acumulado, incluidas 6 nuevas de CQF-F2, antes del ajuste final de serialización de versiones; las 6 nuevas se han repetido satisfactoriamente tras dicho ajuste. Se debe repetir la batería completa antes de cerrar el paquete.
- Verificación sintáctica TS/TSX de todos los archivos cambiados.
- Pruebas de persistencia y auditoría **con servicios de base de datos simulados**, no PostgreSQL real.

## Certificación pendiente en el PC del usuario

```powershell
pnpm control:cqf-f2:check
pnpm typecheck
pnpm build
```

Arrancar mediante `Proofline: 2 · ARRANCAR TODO`. Probar los siguientes recorridos completos:

1. Ventas -> Registrar oportunidad -> guardar START/DEMO -> se redirige a oportunidad persistida -> cambiar etapa/plan con los controles que ya funcionaban -> verificar auditoría `COMMERCIAL_OPPORTUNITY_CREATED`.
2. Intentar crear misma empresa+email con oportunidad aún abierta -> debe rechazar sin crear duplicado.
3. Verificar que otros roles sin `sales.manage` no pueden crear oportunidades (comprobación en API, no solo ocultar el botón).
4. Comunicaciones -> Abrir entrega -> ver estado/fecha/canal/versión y volver sin alterar registro.
5. Comunicaciones -> Abrir evento Outbox -> ver intentos/estado/plantilla sin secretos ni OTP; comprobar permisos denegados.
6. Assessments -> los estados actuales explican 12 completados / 0 pendientes / 0 en curso sin modificar los resultados.
7. Revisar Dashboard, sidebar, scrollbars, Marketplace, Legal & Trust y Seguridad para comprobar ausencia de regresiones.

## No incluidos en F2

- Adapters productivos Redsys/PayPal; no se simula cobro ni conciliación.
- Reenvío manual de Outbox sin idempotencia/autorización.
- Análisis de evidencias demo/producción de métodos de pago; preview integral de retención legal; Pilot E2E del worker.
- Alta pública con aceptación legal: el flujo nuevo **es interno**, no suplanta ese consentimiento.

**Criterio de cierre**: no declarar F2 certificado hasta superar `typecheck`, `build`, pruebas contra PostgreSQL y navegación manual.
