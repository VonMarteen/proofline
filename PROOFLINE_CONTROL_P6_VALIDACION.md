# PROOFLINE CONTROL — P6/7 · Ventas, Onboarding, Suscripciones y Planes

Fecha de entrega: 19/10/2026. Paquete **incremental** para aplicar tras P1, P2, P3 + fix y P4, P5.

## Qué cambia realmente

- **Ventas**: endpoint `GET /v1/control/sales/page` limitado a 25/50/100, filtro por empresa/persona/email exacto, fase, modalidad y plan; contadores de estados globales (no confundidos con total filtrado). Descifrado de email solo de filas de la página; no devuelve el índice ciego ni detalles de pago completos.
- **Onboarding**: selección real de un plan antes de activar contrato; permisos `sales.manage` y auditoría transaccional. Estados de sistema `EVALUATION` y `PROVISIONED` solo mediante los flujos de provisión, no por selector. Pérdida de oportunidad exige motivo. `LOST` y `PROVISIONED` terminales para cambios manuales.
- **Pagos**: configuración ≠ cobro. No se admite marcar Redsys/PayPal como VERIFIED desde Control sin una integración externa. Contrato ACTIVE solo a partir de oportunidad START/WON, plan explícito y **transferencia con plazo NET 15/30/60**. La opción de pago adelantado y proveedores externos desconectados no habilitan la activación. El estado READY designa una condición configurada, no liquidada.
- **Planes**: creación efectiva de nuevo plan a partir de una plantilla existente (capacidades heredadas sin mutar el plan fuente), código único, importes validados, misma moneda que la plantilla y auditoría transaccional. Los contratos existentes siguen referenciando su plan anterior; no se recalculan ni se prorratean facturas.
- **Suscripciones**: filtro SQL por plan y estado y paginación que se reajusta al total filtrado; importes de filas de suscripción y de transacción se muestran en su moneda, no siempre como EUR.
- **Permisos**: API `sales.read`/`sales.manage` y `billing.manage`; consulta del catálogo de planes y entitlements permitida también para roles internos con capacidad de billing, sin abrirles `configuration.read` para módulos ajenos.

## Archivos afectados

- `apps/api/src/commercial/commercial.service.ts`
- `apps/api/src/commercial/commercial.controller.ts`
- `apps/api/src/commercial/p6-policy.ts` (nuevo)
- `apps/api/src/control/control.service.ts`
- `apps/api/src/control/control.controller.ts`
- `apps/api/src/payments/payment.service.ts`
- `apps/control/app/[locale]/sales/page.tsx`
- `apps/control/app/[locale]/plans/page.tsx`
- `apps/control/app/[locale]/subscriptions/page.tsx`
- `apps/control/app/actions.ts`
- `tests/control-p6-commercial.test.mjs` (nuevo)
- `package.json`
- Este documento.

## Ejecutar tras extraer en la raíz de PROOFLINE

```powershell
pnpm control:p6:check
pnpm control:p5:check
pnpm control:p4:check
pnpm control:p3:check
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

No requiere `db:push`, `prisma generate`, actualización de Node ni nuevas dependencias. No ejecutar resets de BD ni modificar volúmenes.

## Pruebas manuales obligatorias

1. Control > **Ventas**. Consultar las páginas 1 y 2 con al menos 26 oportunidades; buscar empresa, persona y email exacto; filtrar WON y START. Confirmar que la UI muestra el total filtrado frente al recuento global por etapa y que 0 registros no genera un error.
2. Con perfil `INTERNAL_FINANCE` se ve Ventas pero **no** controles de gestión; `INTERNAL_OPERATIONS` sí puede seleccionar plan y cambiar etapa. Probar `LOST` sin motivo (debe rechazar) y `LOST` con motivo válido. Probar llamada directa a `POST /v1/control/sales/:id/stage` con `PROVISIONED` (debe rechazar).
3. Seleccionar un plan y verificar en BD/Control que se persiste y aparece en Auditoría como `COMMERCIAL_PLAN_SELECTED`. Crear evaluación de 14 días (sin suscripción de pago); verificar Workspace real y fecha de expiración.
4. Intentar configurar manualmente Redsys/PayPal VERIFIED: debe rechazarse. Configurar READY no acredita un cobro. Intentar activar un contrato con Redsys o PayPal, con transferencia anticipada y sin plan: todo debe bloquearse. Solo contrato de transferencia NET 15/30/60 con plan y oportunidad WON permite conversión/activación.
5. Con perfil autorizado, entrar en **Planes** y clonar una plantilla con código nuevo, precio en la moneda del plan fuente. Confirmar nuevo registro `Plan` y evento `PLAN_CREATED_FROM_TEMPLATE`, sin alterar un plan con suscripciones previas. Código duplicado: 4xx sin cambios.
6. **Suscripciones**: filtrar por plan y estado; revisar páginas, importes y divisas, datos de pago actuales y enlaces a organización. Una operación en el ledger no implica conciliación bancaria: comprobar estado explícito.
7. Probar ES/EN, desktop/móvil, estados vacíos, modal de confirmación y refresh después de acciones.

## Evidencias disponibles y límites

- Ejecutados en este entorno: 11 pruebas nuevas P6 y regresión P2–P6 **40/40**. Sintaxis TS/TSX verificada con TypeScript TranspileModule; no equivale a typecheck completo ni a build.
- `pnpm typecheck`, `pnpm build`, `runtime:check` y `pilot:check` NO ejecutados aquí; el snapshot auditado no incluye `node_modules` ni infraestructura PostgreSQL/Mailpit.
- **Aún no implementado**: integración real Redsys/PayPal, cobros automáticos, conciliación automática de banco, emisión fiscal de facturas por pasarela, prorrateos o upgrades de suscripciones activas, y un expediente contractual con firma verificada. No simular estos procesos.
- La provisión simultánea del mismo lead no tiene aún una prueba E2E de carrera concurrente. No declararla certificada sin prueba de doble envío y evidencia de idempotencia.
