# PROOFLINE — G0/G1 · Auditoría de integridad sobre instalación real

**Fuente de implementación:** `PROOFLINE_ESTADO_REAL_20261023-001019.zip` (código real aportado el 23/10/2026), **sin reconstrucciones de parches**. Git registrado previamente `669fba0e2ac4fd65ddf8fe1ecf1697b003989969`. La captura aportada no contiene la base de datos PostgreSQL ni secretos `.env`.

## Qué contiene esta entrega

- **G0 — copia verificable:** `scripts/proofline-g0.mjs` guarda un ZIP local de los archivos actuales, un manifiesto SHA-256 por archivo y estado Git; valida automáticamente el propio ZIP tras escribirlo. Preserva código, tests, scripts, documentación, archivos ocultos y cambios sin commit. Excluye `.env*`, credenciales por nombre, bases de datos, dependencias, builds y `.runtime` para no extraer datos personales o innecesarios. Los archivos mayores de 25 MB se listan como omisión y bloquean el éxito del gate de código. La copia G0 **NO** sustituye una copia PostgreSQL.
- **G0 — respaldo BD explícito:** `scripts/proofline-g0-db.mjs --confirm-local-database` ejecuta `pg_dump` solo contra `localhost/127.0.0.1` (o `PROOFLINE_DATABASE_URL` local), formato custom, y comprueba estructura con `pg_restore --list`. Requiere binarios PostgreSQL; si no existen, el gate sigue PENDIENTE. **La restauración efectiva sigue sin estar ensayada**.
- **G1 — inspección de integridad:** `scripts/proofline-g1.mjs` examina 5 invariantes H1–H3 en código y genera `.runtime/g1/latest.json`; **OPEN** significa defecto pendiente, no prueba aprobada.
- **G1 — laboratorio de inyección de fallos:** `scripts/proofline-g1-faultlab.mjs` transpila los métodos TypeScript reales en memoria (requiere TypeScript) y usa dobles de dependencias; reproduce cuatro escenarios sin acceso a una base de datos. Genera `.runtime/g1/latest-faultlab.json`. **No son pruebas PostgreSQL E2E**.
- **G1 — anomalías del estado local:** `scripts/proofline-g1-db-readonly.mjs` usa `BEGIN TRANSACTION READ ONLY`, consulta PostgreSQL local y cierra con `ROLLBACK`. Solo almacena **recuentos**, nunca respuestas de personas. Requiere el paquete `pg` de la API ya instalado. Genera `.runtime/g1/latest-db-readonly.json`.

## Ejecución Windows

1. **Extraer este ZIP incremental sobre la carpeta raíz** `C:\Users\aruma\Desktop\PROOFLINE`, conservando los demás archivos. No sustituye ninguna lógica de negocio.
2. Ejecutar **`EJECUTAR_PROOFLINE_G0_G1.cmd`**. El primer paso crea un ZIP nuevo de respaldo en `.runtime\g0\PROOFLINE_G0_BASELINE_<fecha>.zip`. Comprueba que se creó y conserva esa copia en el ordenador.
3. En Windows, con herramientas cliente PostgreSQL instaladas y la instancia local disponible, ejecutar **`EJECUTAR_G0_BACKUP_POSTGRES.cmd`** para el respaldo por separado; exige confirmar escribiendo `RESPALDAR`.
4. Ejecutar tests de infraestructura de gates: `pnpm proofline:g0g1:check`.
5. Ejecutar el laboratorio actualizado en cualquier momento: `pnpm proofline:g1:faultlab`. Para diagnóstico de BD local sin escrituras: `pnpm proofline:g1:db:read`.
6. **Compartir conmigo solo** el ZIP que crea `node scripts/proofline-g0-g1-export.mjs`: `.runtime\g1\PROOFLINE_G0_G1_RESULTADOS_<fecha>.zip`, más el resultado del test si falla. Este ZIP contiene solamente resúmenes, recuentos y estados; no incluye código ni datos de PostgreSQL. **NO subas** la copia de PostgreSQL `.dump`, ni el ZIP G0 con el código local completo.

## Hallazgos reproduccidos antes de modificar las operaciones de negocio

- **H1 launch:** `usageEvent.create` rechaza, el método sigue y deja `ACTIVE`, sin ledger. Prueba en memoria con mock.
- **H1 close:** `assessment.update` persiste `CLOSED`, falla `analysisRun.create`, quedan estados separados. Prueba en memoria con mock.
- **H2 approve:** un informe `DISTRIBUTED` puede volver a `APPROVED` al invocar servicio. Prueba real del método con DB simulada.
- **H3 versioning:** dos ejecuciones concurrentes de `generate` leen la misma versión y crean duplicados. Prueba con barrera concurrente y DB simulada.
- **H1 manual:** inspección fuente: creación del run, outbox y auditoría fuera de transacción; necesita siguiente ensayo transaccional.

Los tests del laboratorio pasan cuando **reproducen correctamente el defecto**. Por tanto, `10/10` pruebas del **instrumental** no equivale a `10/10` operaciones de negocio válidas.

## Criterios exactos de cierre

**G0:** respaldo ZIP verificable, estado Git identificado, prueba de copia de PostgreSQL y posterior ensayo de restauración en una BD aislada, `pnpm typecheck` y `pnpm build` correctos. Sin prueba de restauración o sin DB local, G0 no está cerrado.

**G1:** los cinco controles de código sin hallazgos abiertos y, **en BD de prueba aislada**, forzar fallo de escritura en cada paso y demostrar rollback y no duplicación; lanzar solicitudes concurrentes y verificar atomicidad de `ACTIVE/CLOSED/AnalysisRun/Outbox/Audit/UsageEvent`, transición `DRAFT→APPROVED` única e informes con versión distinta. Verificar `READONLY_DB` sin anomalías pendientes. Hasta entonces, estado **G1 ABIERTO**.

## Límites estrictos

Esta entrega **NO incluye cambios** en assessments controller, ReportService, Prisma schema, scoring, worker, UI, ni acciones de facturación. No ejecuta automáticamente `pnpm pilot:check`, `db:push`, migraciones ni consultas SQL de escritura. G0/G1 dejan lista la base probatoria para una **corrección posterior, transaccional y acotada**. Si al ejecutarla aparece algún fallo propio del instrumental, se corrige ese fallo antes de tocar la lógica de negocio.
