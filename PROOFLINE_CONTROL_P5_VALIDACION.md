# PROOFLINE Control — P5/7 · Assessments, Informes y Marketplace

**Base de reconstrucción:** `PROOFLINE_AUDIT_20261017-0239.zip` + P2/7 + P3/7 + fix TS2322 + P4/7. Este parche es **incremental** para instalaciones que ya incluyen P1–P4; no es un repositorio autónomo.

## Objetivo operativo

P5 hace que los tres módulos informen sobre hechos de la base de datos y habiliten únicamente acciones reales y autorizadas. Mantiene `Entrada → Procesamiento → Resultado → Acción`, separando la visibilidad operativa de la lectura de datos restringidos.

## Cambios incluidos

### Assessments

- Filtros de estado y búsqueda validados; paginación de 25/50/100 en servidor con clamping cuando una página ya no existe.
- Recuento por estado del conjunto filtrado y progreso por assessment obtenido de `Participant.groupBy` (solo agregados por estado).
- Participación: completados / elegibles; los revocados se contabilizan aparte y no inflan el denominador. Sin población elegible muestra `—`, nunca 100 % ficticio.
- La acción **Reprocesar** aparece solo para roles operativos autorizados y assessments CLOSED/ARCHIVED sin análisis en curso; usa el modal de confirmación existente.
- El servidor impide reprocesar estados anteriores al cierre y ejecuciones duplicadas en curso. Usa bloqueo transaccional PostgreSQL por assessment; crea `AnalysisRun`, `OutboxEvent` y `AuditEvent` en una única transacción, conservando `assessmentVersionId` lanzado.
- No cambia reports preexistentes ni desbloquea respuestas de participantes.

### Informes

- Filtros en base de datos por estado, tipo (EXECUTIVE/FULL) y resultado de entregas (PENDING/SENT/FAILED/NONE).
- Recuento de entregas con `ReportDelivery.groupBy` limitado a la página; muestra enviados, pendientes y fallidos por separado, sin consultar destinatarios ni respuestas.
- Fechas reales de aprobación y distribución; huella corta del snapshot con hash completo en tooltip para cotejo técnico.
- La pantalla no afirma que DISTRIBUTED implique que todos los emails se entregaron; ninguna acción de distribución ficticia.

### Marketplace

- Filtros por origen, visibilidad y categoría, además de texto y orden validado.
- Versión más reciente, fecha de publicación, licencia declarada y referencias a assessments; sin cargar dimensiones/scoring y sin consultar respuestas.
- Marketplace Control permanece de lectura. No se añaden botones de «publicar», «aprobar» o «cobrar» mientras no exista el proceso de negocio que los respalde.

## Instalación

1. Conservar un respaldo de los archivos originales si el repositorio local tiene cambios posteriores.
2. Extraer el ZIP desde la raíz `C:\Users\aruma\Desktop\PROOFLINE`, respetando rutas y sobrescribiendo solo los archivos incluidos.
3. No ejecutar `db:push`, `db:reset` ni migraciones: P5 no cambia el esquema Prisma.
4. Ejecutar desde la raíz del monorepo:

```powershell
pnpm control:p5:check
pnpm control:p4:check
pnpm control:p3:check
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

## Certificación manual requerida

- **Assessments:** comprobar 0 / 25 / 26 / 100 / 101 registros, búsqueda + estado, progreso frente a la DB, fecha del último análisis, bloqueo de botón en OPEN/ACTIVE y análisis PENDING/RUNNING. Con rol ANALYST no debe mostrarse Reprocesar. Con rol OPERATIONS sí, solo cuando corresponde. Confirmar que el reprocesamiento produce **un único** AnalysisRun y job RUN_ANALYSIS más AuditEvent, e impide solicitud simultánea. Realizar la prueba destructiva solo en un assessment sintético CLOSED.
- **Informes:** comparar estados DRAFT/APPROVED/DISTRIBUTED, filtrar FAILED/SENT/PENDING/NONE en entregas y comprobar recuentos. No deben aparecer snapshot JSON, respuestas o correos de destinatarios en el payload de lista. Distinguir que SENT significa envío registrado, no entrega SMTP certificada.
- **Marketplace:** origen, visibilidad, categoría, búsqueda y orden. Contrastación de versiones y recuento de assessments contra PostgreSQL; no confundir usos con facturación/licencias.
- **Multiidioma y UX:** ES/EN, modo claro/oscuro, responsive, vacíos, filtros conservados en paginación, confirmación modal y ninguna acción decorativa.

## Verificación realizada en el entorno de preparación

- 9/9 casos P5 (`node --experimental-strip-types --test`) correctos.
- 29/29 casos combinados P2+P3+P4+P5 correctos.
- 6/6 archivos TypeScript/TSX cambiados superan comprobación sintáctica aislada con TypeScript.
- No se ha ejecutado typecheck/build de monorepo ni runtime E2E contra PostgreSQL real en este entorno. La entrega sigue siendo **pendiente de validación Windows**.

## Alcance y límites

Sin nuevas dependencias, sin cambios de Prisma, sin producción, sin acceso a datos personales. La lógica de informes existentes y versionado ya certificado se conserva. Este parche no implementa todavía publicación comercial de frameworks ni operaciones de envío/ aprobación de informes desde Control.
