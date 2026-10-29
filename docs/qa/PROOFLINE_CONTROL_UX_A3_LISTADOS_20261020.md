# PROOFLINE Control · UX-A3 · Listados reales · 20/10/2026

**Base de instalación**: PROOFLINE_AUDIT_20261019-1651 + P7 + UX-A1 + UI-01 + UI-01R + UX-A2.

## Cambios

- Privacidad / Archivo documental: consulta autenticada y paginada en PostgreSQL, búsqueda en título/nombre/clase/organización, estado válido y clase exacta, 25/50/100, total real, vacío real. Nuevo GET `/v1/control/tables/legal/records`.
- Legal & Trust / Evidencias: búsqueda por descripción de documento, actor de evidencia o idioma, acciones validadas, paginación de todas las evidencias. GET `/v1/control/tables/legal/interactions`. No equivale a exportación de evidencia jurídica.
- Seguridad / Eventos privilegiados: búsqueda y paginación de todo el historial **dentro del filtro de seguridad preexistente**, manteniendo `security.read`. GET `/v1/control/tables/security/events`. Auditoría general conserva su propio endpoint.
- Consulta ligera `?view=ui` en `GET /v1/control/legal` y `GET /v1/control/security`: el contrato legacy sin `view` conserva sus listas anteriores. En vista `ui` los históricos se obtienen desde endpoints paginados independientes. El contador de documentos próximos a retención usa `documentRecord.count`, no los 100 primeros documentos.
- Detalle de organización: búsqueda, filtros, ordenación y paginación local de assessments; búsqueda y paginación de **30 eventos de auditoría cargados** etiquetados expresamente como muestra reciente. Para histórico completo sigue disponible Auditoría. Sin cambios a los formularios de pago ni a sus transacciones.
- CSS únicamente para toolbars UX-A3; no se modifica el diseño de KPI, navegación, tokens de scrollbar ni estilos de colores existentes.

## Seguridad y contratos

- Todas las nuevas rutas heredan `InternalDevAuthGuard` y verifican `requireInternalCapability` explícitamente.
- Los resultados de cada consulta son `count + clampedPagination + findMany`, con orden estable fecha DESC + id ASC.
- `pageSize` solo admite 25, 50 y 100 a través del helper existente.
- Los filtros de enumeración están limitados a los valores válidos, sin construir SQL dinámico.
- El cliente no recibe blobs, PII de evidencias, cuerpos de respuesta de assessments ni contenido completo de documentos en los nuevos listados.
- Los endpoints anteriores no se borran, las reglas de retención/hold y pagos no se alteran.

## Evidencia local

- `node --experimental-strip-types --test tests/control-*.test.mjs` (Node 22 del entorno de trabajo): **89/89 OK**. Incluye 12 tests nuevos UX-A3, 5 de ellos ejercitando lógica de consultas con DB simulada.
- Comprobación de sintaxis TS/TSX de los archivos modificados mediante TypeScript local: OK.
- **NO ejecutados aquí**: `pnpm typecheck`, `pnpm build`, API / PostgreSQL reales, navegador, `runtime:check`, `pilot:check`. Los tests no certifican producción.

## Validación Windows

1. Extraer el ZIP incremental en la raíz PROOFLINE ya actualizada a UX-A2. NO borrar carpetas ni limpiar DB.
2. Ejecutar `pnpm control:uxa3:check`, `pnpm control:uxa2:check`, `pnpm typecheck`, `pnpm build`.
3. Reiniciar **Proofline: 2 · ARRANCAR TODO**; ejecutar `pnpm services:check`, `pnpm runtime:check`, `pnpm pilot:check`.
4. Privacidad: buscar 2 términos, filtrar ACTIVE/BLOCKED, seleccionar 25/50/100 y navegar 2 páginas si hay volumen; cotejar total con API/BD.
5. Legal: buscar evidencia; filtrar ACCEPT / CONSENT; confirmar total y que una nueva evidencia aparece al refrescar.
6. Seguridad: comprobar con un rol sin `security.read` que devuelve 403, y con rol autorizado que el total y filtros corresponden al histórico; navegar páginas.
7. Detalle de organización: validar filtrado por estado de assessment y comprobar que la auditoría se identifica como **30 eventos recientes**, no como histórico completo.
8. Revisar interfaz ES/EN, oscuro/claro, móvil, teclado, y scrollbar de sidebar; confirmar que no aparecen errores de React.

Si un test local falla, recopilar el mensaje completo antes de un parche; no reinterpretar el fallo como éxito.
