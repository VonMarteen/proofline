# PROOFLINE Control — CQF-F3 (20/10/2026)

## Alcance y límite
Base: CQF-F2 confirmado por el usuario. Esta entrega trata exclusivamente evidencia de movimientos manuales y límites de ejecución de retención. No crea adaptadores Redsys o PayPal, no considera pagados contratos por registrar referencias y no modifica el motor de scoring, Prisma, configuración de infraestructura, sidebar, scrollbars ni otros módulos.

## Pagos
- Endpoint existente `POST /v1/control/organizations/:id/payment-transactions`: requiere `billing.manage` como antes. Para `BANK_TRANSFER`, el tipo es `TRANSFER`, la conciliación `RECONCILED` exige una referencia de extracto/operación de al menos cinco caracteres y un importe positivo. Se conserva `PENDING`, `FAILED`, `CANCELED` y `AWAITING_TRANSFER` sin fingir liquidación.
- Las entradas manuales de Redsys/PayPal pueden documentar `PENDING`, `FAILED` o `CANCELED` sin acreditar un cobro; no pueden introducir `AUTHORIZED`, `CAPTURED`, `RECONCILED` o `REFUNDED` como liquidaciones externas.
- Se añade `metadata.evidenceSource` (fuente DECLARADA, no comprobación automática bancaria) y se sigue registrando auditoría. Históricos anteriores no se reescriben; la consulta de movimientos señala `LEGACY_MANUAL_ENTRY` cuando procede.
- La vista de organización no propone CAPTURED por defecto para proveedores desconectados, distingue la declaración manual de un cobro verificado y aclara que activar una referencia no equivale a cobrar.

## Retención
- La vista previa sigue limitando cantidad de candidatos, y ahora incluye `coverage` con `candidateLimit`, `candidatesTruncated`, `sourceScanMayBeTruncated` y `sourcesScanned`. `summary` corresponde a los registros examinados, nunca se presenta como totalidad si `coverage.complete` es falso.
- Si los candidatos superan el límite o alguna consulta llega al límite de exploración, `execute` se **rechaza antes de tocar datos**. También se requiere `organizationId` explícito para ejecutar. No se ejecutan acciones destructivas globales.
- El UI permite seleccionar organización antes de consultar; ejecución solo habilitada si la vista previa es completa y el usuario ha seleccionado una organización. La confirmación modal y nueva evaluación de legal holds se conservan.
- La cobertura completa de una exploración acotada no demuestra exhaustividad jurídica ni sustituye la revisión legal, ni resuelve la concurrencia de un cambio de política entre la vista previa y la ejecución.

## Verificación automatizada
`pnpm control:cqf-f3:check` — policy cases; PaymentService mock + auditoría, preview completa/parcial, bloqueo de ejecución incompleta, comprobación de sintaxis.
`node --experimental-strip-types --test tests/control-*.test.mjs` — regresión agregada en entorno Linux con Node 22.

## Verificación real requerida en Windows
1. `pnpm control:cqf-f3:check`, `pnpm typecheck`, `pnpm build`.
2. Reiniciar desde VS Code (`Proofline: 2 · ARRANCAR TODO`).
3. Entrar en una organización. Verificar que Redsys/PayPal no ofrecen CAPTURED, y que `PENDING` conserva historial sin contar como cobro. Probar que una petición directa a la API con status CAPTURED y provider REDSYS responde error y no crea transacción.
4. En una organización con transferencia, registrar `AWAITING_TRANSFER`; verificar que `RECONCILED` sin referencia se rechaza y con referencia se registra y audita, sin alterar facturas existentes de forma automática.
5. En Legal & Trust comprobar la vista global solo lectura, seleccionar una organización, confirmar que las muestras parciales bloquean ejecución y que los legal holds siguen protegiendo datos. **No ejecutar DELETE/ANONYMIZE en datos reales sin backup, revisión legal y plan de reversión**.
6. Registrar salida de `pnpm services:check` y `pnpm pilot:check` (piloto aún no certificado). Revisar ambas variantes ES/EN y responsive.

## Estado
Código y pruebas automatizadas: sí. Integración con PostgreSQL, compilación de Nest/Next, navegador Windows, ejecución destructiva y pagos externos: **no verificados aquí**. Ningún movimiento manual se considera confirmación de banco externo sin comprobación humana documentada.
