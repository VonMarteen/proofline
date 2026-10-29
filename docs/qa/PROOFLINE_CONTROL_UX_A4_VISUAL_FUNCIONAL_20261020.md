# PROOFLINE Control — UX-A4 · Consistencia visual y divulgación progresiva

Fecha: 2026-10-20 · Base de instalación requerida: UX-A3 aplicada y validada.

## Alcance implementado

- `sales/page.tsx`: mantiene consultas paginadas, RBAC, acciones `selectCommercialPlan`, `updateCommercialStage`, `configureCommercialPayment`, `createEvaluationWorkspace` y `provisionCustomer`. Agrupa las tres acciones de edición de cada fila en elementos `<details>` accesibles, cerrados por defecto. Todas las confirmaciones siguen en los `<form>` originales. Añade nombres accesibles a los campos de edición sin etiqueta visible.
- `internal-users/page.tsx`: los textos explicativos de roles se resuelven en ES/EN. Los campos de invitación tienen etiquetas explícitas y validación HTML; el `<option value>` conserva el identificador `INTERNAL_*` del backend aunque la leyenda sea legible. Los permisos `canCreate` y las operaciones de alta no se modifican.
- `security/page.tsx`: las capacidades reales devueltas por el servicio se muestran bajo divulgación progresiva sin omitir datos; se confirma la creación de usuarios. La API de gobierno y el listado paginado de eventos se conservan.
- `plans/page.tsx`: muestra el estado vacío cuando no existen planes, sin inventar catálogo.
- `backoffice.css`: estilos **limitados** a estas superficies: tarjetas compactas de Ventas, acciones desplegables, cuadrícula del formulario de invitaciones, matriz de roles y adaptación responsive. No se modificaron los scrollbars globales ni las reglas de navegación, fechas o KPI del Dashboard.

## Evidencia de verificación en entorno de revisión

- 96/96 pruebas de Node con `--experimental-strip-types` (incluidas 7 nuevas de UX-A4). Las anteriores incluyen pruebas estáticas y tests sobre lógica aislada; no constituyen E2E contra PostgreSQL.
- TSX de las cuatro páginas modificadas analizado por TypeScript `transpileModule` sin diagnósticos sintácticos.
- Smoke de CSS/DOM con Chromium sobre **fixture aislada** (no aplicación Next en ejecución) para anchuras 1440, 1024 y 390: detalles cerrados inicialmente, apertura visible con clic, controles de 36px y sin overflow del documento; la tabla tiene scroll horizontal local si hace falta.
- No se ejecutaron Typecheck del monorepo, compilación integral, pruebas API integradas ni revisión visual del producto real en este entorno (dependencias/servicios no disponibles).

## Prueba obligatoria después de instalar (Windows)

1. Descomprimir el ZIP en la raíz de `C:\Users\aruma\Desktop\PROOFLINE`, conservando rutas. No borrar `node_modules`, datos ni `.env`.
2. Ejecutar `pnpm control:uxa4:check`, `pnpm control:ui01:check`, `pnpm control:uxa3:check`, `pnpm typecheck` y `pnpm build`.
3. Arrancar con la tarea `Proofline: 2 · ARRANCAR TODO` y comprobar `pnpm services:check`.
4. En Ventas (ES y EN), aplicar filtros, cambiar páginas, abrir y cerrar las 3 acciones; verificar permisos y confirmar una operación únicamente con una oportunidad de prueba. Comprobar visualización de contrato y que un pago sin evidencia no se marca cobrado.
5. En Usuarios internos, verificar roles traducidos y confirmar que el valor enviado sigue siendo exactamente `INTERNAL_SUPPORT`, `INTERNAL_FINANCE`, etc. Probar invitación de prueba con Owner y acceso denegado con otros roles.
6. En Seguridad, comprobar que la matriz de capacidades expande correctamente y que el alta queda protegida por confirmación y por RBAC.
7. En Planes, comprobar catálogo, creación de variantes y paginación de capacidades existentes. No ejecutar nuevas altas comerciales reales durante QA salvo intención explícita.
8. Verificar Desktop 1440 y 1024, tablet y móvil 390, tema claro/oscuro, ES/EN; confirmar que los scrollbars, tarjetas del Dashboard, navegación y métricas de UX-A2 no han cambiado.
9. Ejecutar `pnpm runtime:check` y `pnpm pilot:check`. El timeout anterior del piloto **no** se considera resuelto por este parche.

## Límites / no certificaciones

UX-A4 aporta correcciones verificables de las pantallas señaladas, pero **NO** certifica que todas las rutas de Control estén visualmente perfectas, la WCAG AA global, ni la preparación de producción. Requiere comprobación en navegador real y revisión de regresiones con los servicios levantados. Las integraciones externas de pago siguen fuera del alcance.
