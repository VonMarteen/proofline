# PROOFLINE Control — CQF-F4: trazabilidad de assessments e informes

20/10/2026 · Aplicar **únicamente sobre la versión validada CQF-F3**.

## Objetivo

Cerrar una carencia administrativa de Control sin tocar los flujos previamente validados: desde el listado de assessments se abre una ficha con la progresión agregada, ejecuciones y enlaces a los informes generados. Desde el listado de informes se abre un detalle de su estado y la evidencia de distribución.

## Cambios concretos

1. `GET /v1/control/assessments/:id/operational-detail`, autorizado por `assessments.read`. Selecciones limitadas a metadatos y recuentos de participantes, últimas **20** ejecuciones y últimos **20** informes. Devuelve el total real para informar si el listado es parcial. El error de un análisis se resume a `errorRecorded`; nunca se devuelve el error crudo o el `result` del análisis.
2. `GET /v1/control/reports/:id/operational-detail?page=&pageSize=`, autorizado por `reports.read`. Cuenta **todas** las entregas y pagina en PostgreSQL a **25/50/100**; muestra solo fecha, canal, estado y presencia de error. No obtiene snapshot, respuestas ni datos del destinatario.
3. Listados anteriores conservados con el título enlazado a la nueva ficha. Páginas de detalle separadas y controles de lectura compatibles con ES/EN. Los detalles de entrega se abren mediante la funcionalidad existente de Comunicaciones solo para roles autorizados.
4. Reprocesamiento de assessments: **reutiliza** la acción transaccional previa, autorizada, auditada y protegida contra dobles ejecuciones. No crea otra ruta de escritura.

## Qué no se modifica

- Navegación lateral, scrollbars, Dashboard, CSS/tokens, hojas de estilo, modos claro/oscuro, filtros/paginación de los listados originales.
- Modelos Prisma, migraciones, credenciales, infraestructura, procesos de cobro, scoring, contenidos de informes, estados ni reglas de auditoría.
- APIs existentes: se **añaden** dos endpoints de lectura sin reemplazar contratos.

## Pruebas previas a la entrega

- 135/135 tests del conjunto `tests/control-*.test.mjs` correctos con Node 22 `--experimental-strip-types` en el entorno de revisión. Incluyen 6 pruebas CQF-F4 con simulaciones de base de datos y controles de permisos.
- **Pendientes**: Typecheck/build completos de Next/Nest, integración real con PostgreSQL y revisión con navegador y datos locales del usuario.

## Instalación Windows

Extraer este ZIP incremental desde la raíz `C:\Users\aruma\Desktop\PROOFLINE`, sin eliminar ningún otro archivo. Mantener el arranque habitual `Proofline: 2 · ARRANCAR TODO`.

```powershell
pnpm control:cqf-f4:check
pnpm typecheck
pnpm build
pnpm services:check
pnpm runtime:check
pnpm pilot:check
```

## Validación manual obligatoria

1. Abrir Assessments, entrar en un assessment cerrado, comprobar fecha/estado, 12/12 si es el caso, conteos de estados **actuales**, ejecuciones e informes y enlaces.
2. Abrir un assessment con un análisis en curso: no debe ofrecer reprocesamiento. Comprobar que un rol solo lectura no ve la acción. Evitar solicitar un reprocess de prueba contra datos valiosos.
3. Entrar desde Informes a un reporte y comprobar su hash y fechas sin confundir estado DISTRIBUTED con entrega recibida; probar paginación de entregas si hay más de 25.
4. Seguir un enlace a Comunicaciones con una cuenta autorizada: debe abrir el detalle existente. Probar accesos denegados a los nuevos endpoints para usuarios sin los permisos correspondientes.
5. Volver a Dashboard, Marketplace, Legal y Seguridad y confirmar que permanecen iguales. Verificar cabecera fija, scrollbars y los formularios ya aprobados.

## Limitaciones explícitas

- Este parche no ofrece aprobación, publicación ni distribución de informes desde Control; esas acciones no deben inventarse ni replicar permisos del Workspace.
- La ficha de assessment muestra hasta 20 análisis e informes; lo indica y remite a los listados de histórico.
- Las pruebas locales no sustituyen el piloto E2E; el timeout histórico debe diagnosticarse aparte.
