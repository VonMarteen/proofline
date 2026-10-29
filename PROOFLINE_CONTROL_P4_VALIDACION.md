# PROOFLINE CONTROL — P4/7 | Soporte · Histórico · Alertas · Operaciones · Sistema

**Corte:** 2026-10-17. **Entrega:** parche ZIP incremental respecto del snapshot de 17/10/2026 + P2/7 + P3/7 y su fix TS2322. No es un repositorio completo.

## Cambios realizados

1. **Soporte:** búsqueda por ticket/asunto/organización y filtros de prioridad/estado ejecutados en PostgreSQL con paginación 25/50/100; preserva el alcance de visibilidad del agente. Las métricas globales continúan independientes de los filtros. Los tickets resueltos no se etiquetan erróneamente como SLA vencido.
2. **Histórico:** filtro por estado y búsqueda, orden por fecha de cierre/resolución, fecha ausente mostrada como «—» (no se utiliza `updatedAt` como sustituto engañoso).
3. **Operaciones:** filtros DB por estado/tipo de job y estado de análisis; paginación independiente y ajustada al número de resultados, contadores globales basados en `groupBy`. Los reintentos siguen invocando la mutación auditada, sólo para FAILED.
4. **Alertas:** totales y críticos computados con queries `count()` independientes de la vista previa (máximo 60), separados por capacidades. Los filtros de severidad/área operan **sobre la vista previa**; se indica expresamente que los fallos de pago son registros históricos pendientes de evaluar y no «alertas activas» deducidas.
5. **Sistema:** lista de procesos recientes limitada por consulta paginada (máximo 25) y enlaces de actualización/investigación; probes reales existentes preservados y mensajes de error de probe no filtran URLs internas ni errores crudos.
6. **Acciones:** reutiliza `ConfirmActionProvider` global existente para confirmar cambios de estado, asignaciones, mensajes, solicitudes y reintentos. No instala un segundo sistema modal. Invalida rutas relacionadas después de las acciones.

## Fuera del alcance

- No se modifica el esquema Prisma ni se ejecutan migraciones.
- No se alteran los flujos de facturación, scoring, respuesta del participante ni los informes.
- Los filtros de alertas **no** realizan búsquedas completas en todo el histórico; para eso usar las pantallas de cada área.
- No se ha validado un entorno de producción, una base con datos reales ni el rendimiento bajo carga.

## Evidencia local de este paquete

- Unitarias y contractuales P4: **7/7** correctas (ejecutadas con Node 22 + soporte TS local).
- Pruebas regresivas P2: **6/6** correctas; P3: **7/7** correctas (sin ejecución de servicios externos).
- Revisión sintáctica de los archivos TypeScript/TSX cambiados: sin errores de parseo.
- **NO EJECUTADO en el entorno de empaquetado:** `pnpm typecheck`, `pnpm build`, `pnpm runtime:check`, `pnpm pilot:check`; el ZIP de auditoría omite `node_modules` y los servicios locales PostgreSQL/Analytics/Mailpit. Estas comprobaciones son obligatorias en Windows antes de declarar P4 cerrada.

## Instalación

1. Aplicar previamente P2, P3 y `PROOFLINE_CONTROL_P3_FIX_TS2322_METRIC_20261017.zip` en ese orden.
2. Extraer este ZIP directamente en `C:\Users\aruma\Desktop\PROOFLINE`, respetando las rutas.
3. No ejecutar `db:push`, `db:reset` ni actualizar dependencias para este parche.
4. Ejecutar desde la raíz:

```powershell
pnpm control:p4:check
pnpm control:p3:check
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

## Verificación manual obligatoria

- Soporte: filtrar por prioridad, estado y organización; abrir un ticket y guardar un nuevo estado (confirmación global); verificar persistencia y auditoría.
- Histórico: cerrar/resolver un ticket; confirmar que figura con fecha real y que el filtro no revela históricos prohibidos al rol Support.
- Operaciones: filtrar FAILED y tipo; con un job FAILED de prueba confirmar un reintento, ver el estado PENDING y el evento de auditoría; comprobar estados vacíos.
- Alertas: forzar una señal de prueba y comparar total global con la lista limitada, verificar que un rol sin billing.read no consulta datos financieros.
- Sistema: probar un servicio local degradado y confirmar que el estado no aparece HEALTHY; verificar que el sistema no expone secretos en los detalles.
- Inspeccionar ES/EN, claro/oscuro, escritorio/móvil y el funcionamiento de filtros tras navegar por las páginas.

**Regla de cierre:** un ZIP entregado no equivale a código instalado. P4 sólo se declara certificada tras los gates en el equipo del usuario y la verificación funcional indicada.
