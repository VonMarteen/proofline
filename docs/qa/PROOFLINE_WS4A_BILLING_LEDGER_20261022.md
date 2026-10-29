# PROOFLINE Workspace WS4-A — Ledger de uso filtrable

Alcance: **únicamente** lista de consumo del Workspace y su consulta de servidor. No se tocan Control, pagos, entitlements, contratos ni políticas de privacidad.

- Nuevos filtros de consulta: `period` (AAAA-MM), `eventType` (código canónico) y `billable` (`true`/`false`).
- Comprobación en backend de formato antes de consultar.
- El predicado **siempre** incluye `organizationId` obtenido mediante `billing.view`; se aplica tanto al COUNT como a la página.
- Conserva paginación real, tamaño de página, datos existentes, roles y endpoints anteriores. Sin filtros: misma respuesta.
- La UI presenta dos eventos confirmados por código: `RESPONSE_COMPLETED`, `ASSESSMENT_LAUNCHED`; otros tipos siguen visibles en `Todos los eventos`.
- Un resumen total muestra los registros del conjunto filtrado; estado vacío cuando no existen coincidencias.
- No cambia la semántica del contador `capacity.used`, que permanece ligada al período corriente y respuestas facturables.

## Validación operativa pendiente en Windows
1. `node --test tests/workspace-ws4-billing-ledger.test.mjs`, `pnpm typecheck`, `pnpm build`.
2. Con servicios iniciados, entrar en Workspace (`4202`) como rol `BILLING_ADMIN` u `OWNER`: filtrar diferentes meses y eventos, y verificar contador y páginas.
3. Probar cero resultados; limpiar y confirmar que el listado vuelve a la versión anterior.
4. Verificar que un rol sin `billing.view` no obtiene movimientos de consumo; comprobar aislamiento entre organizaciones.
5. Comprobar que facturas y cambio de método siguen funcionando con normalidad.

No se proclama E2E certificado hasta ejecutar consulta contra PostgreSQL del usuario.
