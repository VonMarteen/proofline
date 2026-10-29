# PROOFLINE — Sidebar opción A + Smoke de análisis (2026-10-22)

## Base
Aplicar sobre la versión instalada posterior a WS-3 (incluido fix WS-2 TS2554). El ZIP contiene solo los seis archivos explícitos; no reemplaza ni reconstruye el monorepo.

## Cambios

1. `apps/control/app/backoffice.css`: añade solo `padding:0 12px 0 3px` a la navegación interna de escritorio. No modifica `scrollbar-color`, `scrollbar-width`, dimensiones de la barra, menú, ni los estilos base.
2. `apps/web/app/workspace.css`: mismo espaciado sobre la navegación de escritorio existente; no modifica el tema, cabecera ni el footer.
3. `scripts/check-services.mjs` y `scripts/check-services-analysis-policy.mjs`: seleccionan CLOSED/ARCHIVED para *crear* nuevas ejecuciones de análisis. Se admiten resultados COMPLETED existentes sin mutaciones para comprobar evidencia pasada. Se esperan ejecuciones ya pendientes en vez de duplicarlas. Si no existe assessment cerrado accesible ni análisis completado, se imprime `[PENDIENTE]` (nunca `[OK]`) y se indica ejecutar `pnpm pilot:check`. `services:check` solo falla por fallos reales de los servicios o de una prueba elegible; una certificación E2E no comprobable se explicita y no se contabiliza como prueba correcta.
4. `tests/proofline-sidebar-services-hotfix.test.mjs`: siete regresiones específicas del selector, protección del ciclo de vida, scrollbars y separación.

## Validación ejecutada en entorno de revisión

- `node --check` sobre ambos scripts: OK.
- `node --test tests/proofline-sidebar-services-hotfix.test.mjs`: 7/7 OK.
- `node --experimental-strip-types --test tests/*.test.mjs`: 178/178 OK. Estas son pruebas mayoritariamente unitarias, de contratos y estáticas, NO pruebas E2E con PostgreSQL real.
- Chromium a 1440 × 800: `padding-left=3px`, `padding-right=12px`, `overflow-y=auto`, scroll vertical real y cabecera fija de Control y Workspace. La prueba visual usa un DOM de referencia con CSS del proyecto, NO autentica ni navega la app en el entorno Windows del cliente.

## Comprobaciones en Windows

```powershell
node --test tests/proofline-sidebar-services-hotfix.test.mjs
pnpm workspace:ws3:check
pnpm typecheck
pnpm build
pnpm services:check
pnpm pilot:check
```

Mantener los servicios arrancados durante `services:check` y `pilot:check`. Si el sistema informa `[PENDIENTE] Worker + Analytics` significa que no se encontraba un assessment cerrado accesible ni evidencia completada; la disponibilidad de Analytics y la API puede ser correcta, pero **no hay certificación E2E**. `pilot:check` es la prueba que intenta cubrir ese flujo con sus propios datos de prueba. Nunca cerrar ni alterar assessments de clientes para satisfacer el smoke.

## Congelaciones

Sin cambios en scoring, Prisma, permisos RBAC, API, estados de assessments, navegación funcional, scrollbars globales, informes, procesos de Control o lógica del Workspace.
