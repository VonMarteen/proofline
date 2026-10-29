# PROOFLINE — Workspace WS-3 · Distribución de informes verificable

Fecha: 22/10/2026. Base: WS-3 + Hotfix scrollbar opción A / services smoke, aceptado por el usuario.

## Cambios incluidos
- Primera distribución: reserva optimista por `Report.updatedAt`, comprobación de entregas previas y creación de **todas** las entregas, trabajos `SEND_EMAIL` y auditoría en una única transacción PostgreSQL.
- No se cambia `distributedAt` ni `ReportStatus`: siguen representando el estado real del trabajador de correo. No se añade migración.
- API nueva `POST /v1/reports/:id/retry-failed`, protegida con `reports.distribute`. Reintenta únicamente `FAILED` cuando no quedan trabajos `PENDING` y los destinatarios siguen activos. Nunca reenvía `SENT`.
- Workspace muestra enviados, pendientes y fallidos, elimina la opción de volver a solicitar la misma distribución y ofrece una acción explícita de reintento de fallidos al Owner.
- No se modifica Control, navegación, estilos globales, motor analítico, reglas de pricing ni ciclo de participación.

## Comprobaciones automáticas
Desde la raíz: `pnpm workspace:ws3:distribution:check`, `pnpm workspace:ws3:check`, `pnpm typecheck`, `pnpm build`.
Las pruebas de la entrega comprueban rollback al fallar un trabajo, bloqueo de duplicados incluyendo concurrencia, reintento selectivo, destinatario inactivo y RBAC.

## Verificación local segura
Usar exclusivamente organización, assessment cerrado, informe aprobado y destinatarios de **Mailpit**/datos de prueba. No utilizar cuentas reales.
1. Generar y aprobar un informe de prueba. Solicitar la distribución UNA vez. Comprobar en PostgreSQL: una `ReportDelivery` por destinatario, un `OutboxEvent` por entrega, y una auditoría `REPORT_DISTRIBUTION_QUEUED`.
2. Actualizar la pantalla: no debe permitir distribuirlo de nuevo; mostrar estados PENDING/SENT/FAILED.
3. Dejar al worker procesar y revisar que el informe solo cambia a DISTRIBUTED cuando todas las entregas están SENT. `SENT` no equivale a leído.
4. En entorno controlado, simular el fallo de uno de los envíos y mantener uno enviado. Esperar que no haya PENDING. Pulsar «Reintentar N fallidos». Confirmar que **solo** genera eventos para el destinatario fallido.
5. Comprobar un rol sin `reports.distribute`: debe recibir rechazo de API (403), aunque invoque la URL directamente.
6. Volver a abrir el informe: comprobar PDF, historial y fechas. Verificar que no se cambian nombres, contenido ni hash del snapshot.

## Límites / restricciones
- Las pruebas ejecutadas aquí no sustituyen a PostgreSQL ni al SMTP real. La compilación integral solo puede certificarse en la instalación Windows.
- No se diseñó un sistema masivo de distribución; transacciones de más de 30 s fallan íntegramente y deben dimensionarse antes de producción a gran escala.
- Los reintentos son manuales, no una promesa de entregabilidad: los estados de Mailpit/worker no demuestran apertura o recepción final.
- Los reportes con entregas históricas de versiones antiguas son reconocidos; pueden reintentar fallidos sin exigir `distributedAt`.
