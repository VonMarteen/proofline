# PROOFLINE Control — CQF 1/3 · Correcciones visuales seguras
ARMAR Technologies · 20/10/2026

## Base y aplicación
Base: último código confirmado por el usuario (snapshot 19/10 + P7 + UX-A1 + UI-01 + UI-01R + UX-A2 + UX-A3 + UX-A4). Este ZIP es incremental; extraer en la raíz del proyecto conservando las rutas y sin borrar otros archivos. **No contiene datos, migraciones ni secretos.**

## Cambios y criterios de aceptación
| Sección | Cambio | Comprobación manual |
|---|---|---|
| Seguridad / Separación de zonas | CSS exclusivo `control-trust-zones` con las tres zonas en tarjetas densas y adaptativas | Títulos, valores, descripciones legibles y separados, sin desbordamiento a 390/1024/1440 px; ES/EN y temas |
| Uso / Por organización | Estado vacío contextual por período, sin valores simulados | Con cero eventos se muestra explicación; con eventos, el resumen no cambia |
| Uso / Por tipo | Estado vacío contextual | Igual; los totales siguen procediendo de API |
| Uso / Ledger | Fila de vacío con `colSpan=6` | En ausencia de eventos aparece mensaje; paginación permanece; con datos muestra las mismas filas |
| Auditoría | Metadatos JSON en `<details>` accesible (cerrado inicialmente), con `<pre>` de altura limitada | Se abre con clic, Enter/Espacio; no desaparecen metadatos; filtros, total y paginación persisten |
| ES/EN de Uso | `eventos/billable/yes` traducidos de forma contextual | Cambiar idioma y comprobar texto |

## Regresiones que no deben ocurrir
- Se conservan intactos endpoints y respuestas API, autenticación, RBAC y separación de identidades; `audit.read` continúa exigido por backend.
- Sin cambios a retención, pagos, scoring, worker, configuración ni facturación.
- No modificar ni sustituir el sistema de scrollbars `@proofline/design-tokens/base.css`, la barra lateral, las tarjetas KPI ni los filtros/paginación actuales.
- Una vista sin registros debe mostrar un estado vacío, no un error ni valores ficticios.
- Metadatos de auditoría aún se envían a usuarios autorizados como antes; este bloque **no** introduce redacción de datos ni cambia políticas de privacidad.

## Verificación realizada en entorno de preparación
- `node --test tests/control-cqf1-20261020.test.mjs`: **8/8**, incluido análisis sintáctico TSX con TypeScript.
- Regresión de tests seleccionados P3, UI-01R, Visual, UX-A2, UX-A3, UX-A4 y CQF1: **53/53**, sin fallos.
- La revisión de layout en Chromium no pudo concluir en este entorno por límite de ejecución. No se declara responsive ni funcionamiento en navegador certificados.
- **Sin** compilación global del monorepo, peticiones reales a PostgreSQL ni pruebas E2E aquí.

## Validación en equipo Windows (raíz de PROOFLINE)
1. Descomprimir el ZIP incremental sobre la versión UX-A4 validada, conservando jerarquía de carpetas.
2. `pnpm control:cqf1:check`
3. `pnpm control:uxa4:check`
4. `pnpm typecheck`
5. `pnpm build`
6. Reiniciar por VS Code: **Proofline: 2 · ARRANCAR TODO**.
7. Comprobar `/es/security` y `/en/security`: Trust zones desktop/tablet/mobile, modo claro y oscuro.
8. Comprobar `/es/usage`, `/en/usage` con período sin registros y otro con registros (si disponible). No cambiar fixture productivo para forzar vacíos.
9. Comprobar `/es/audit`, `/en/audit`: desplegar/cerrar metadata, navegación por teclado, búsqueda y paginación.
10. Confirmar que el scrollbar de la barra lateral y las cuatro tarjetas del Dashboard **no han cambiado**.

## Pendiente CQF 2/3
Verificar y corregir, con evidencia de API/datos reales: método Redsys etiquetado demo, discrepancias de participación de assessments, límite/alcance del retention dry run, oportunidades comerciales sin siguiente acción y estados reales de distribución/entrega. Prohibido simular cobros, invitaciones o retenciones.

## Pendiente CQF 3/3
QA integrada ES/EN, tema claro/oscuro, responsive y flujos E2E incluyendo `pilot:check`/worker, con separación clara entre pruebas automáticas, manuales y certificación de producción.
