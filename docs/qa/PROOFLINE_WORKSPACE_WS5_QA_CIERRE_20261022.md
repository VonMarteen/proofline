# PROOFLINE · Workspace WS-5/5 · QA de cierre

Fecha: 2026-10-22 · Entrega incremental WS-5 (seguridad de interacción + controles automatizados).

## 1. Base congelada

Se construyó sobre WS-4B más el hotfix «iconos sin texto». No incluye modificaciones de Control, Site, Respond, Support, CSS, tokens, contratos de API, Prisma, base de datos ni infraestructura.

## 2. Cambio funcional limitado

- `apps/web/components/analysis-runner.tsx`: solicitudes de análisis con `try/catch/finally`, retroalimentación ES/EN ante interrupción de red y recuperación de `busy`. Polling serializado con un solo temporizador; el polling fallido indica reintento automático sin generar trabajos duplicados, sin leer respuestas individuales ni alterar scoring.
- `apps/web/components/assessment-actions.tsx`: petición de Proofline Check y transiciones con `try/catch/finally`, bloqueo de doble envío simultáneo, deshabilitación temporal de botones y recuperación de estados visuales. Se conservan permisos, lista de transiciones y condición `canLaunch`.
- `scripts/workspace-ws5-readonly-smoke.mjs`: comprobación local estrictamente GET sobre loopback, contratos esperados, ES/EN, sin acciones de escritura ni credenciales productivas. Utiliza exclusivamente la identidad demo existente; NO se ejecuta sobre producción.

## 3. Resultado de pruebas (ambiente de preparación)

- Batería `node --experimental-strip-types --test tests/*.test.mjs`: 220/220 correctas (incluyendo 12 nuevas WS-5), con Node 22 para análisis de tests. La compatibilidad con Node 20 debe certificarse mediante los comandos `pnpm` en Windows.
- No se ejecutó contra PostgreSQL real, Docker, Next.js integrado ni un navegador autenticado en este entorno.
- Los tests de fuente y payloads simulados no certifican acciones E2E reales.

## 4. Instalación y prueba local

1. Extraer el ZIP incremental sobre PROOFLINE después de WS-4B y el hotfix de iconografía.
2. Arrancar la tarea de VS Code **Proofline: 2 · ARRANCAR TODO**.
3. Ejecutar, desde la raíz:

```powershell
pnpm workspace:ws5:check
pnpm workspace:ws5:smoke
node --test tests/workspace-ws4b-privacy-support.test.mjs
pnpm typecheck
pnpm build
pnpm services:check
pnpm runtime:check
pnpm pilot:check
```



**Atención:** El smoke WS-5 solo realiza lecturas. Si no hay fixture demo o la autenticación local no permite los headers de la identidad demo, devolverá FALLO. No relajar el RBAC para hacerlo pasar. Tampoco confundir un HTTP 302 de login con un recorrido autenticado E2E.

## 5. Matriz manual de certificación (evidencia pendiente)

| Gate | Rol / acción | Resultado verificable | Estado |
| --- | --- | --- | --- |
| G01 | OWNER inicia sesión y cambia organización (si autorizado) | Sin fuga de datos de otra organización | PENDIENTE |
| G02 | OWNER crea assessment manual L1–L4 | Recarga conserva nivel, preguntas y auditoría | PENDIENTE |
| G03 | OWNER crea desde Library | Proveniencia y versión persistidas | PENDIENTE |
| G04 | OWNER importa documento de prueba | Una sola creación, sin duplicado | PENDIENTE |
| G05 | ADMIN edita cuestionario / población antes de lanzamiento | Datos conservados; cambios auditados | PENDIENTE |
| G06 | Usuario sin permiso intenta cambiar rol privilegiado | API devuelve 403; no cambia membresía | PENDIENTE |
| G07 | OWNER configura privacidad, aviso y destinatarios | Persistencia coherente entre Workspace y Respond | PENDIENTE |
| G08 | OWNER ejecuta Check y aprueba preview | Readiness refleja condiciones reales | PENDIENTE |
| G09 | OWNER lanza assessment demo | Se crea participación/uso real sin duplicados | PENDIENTE |
| G10 | Participante demo responde desde Respond | Resultado guardado en el assessment correcto | PENDIENTE |
| G11 | OWNER cierra assessment | Scoring no se permite antes de cierre | PENDIENTE |
| G12 | ANALYST ejecuta análisis | Worker + Analytics generan evidencia real; sin timeout | PENDIENTE |
| G13 | Generar informes L1–L4 | Datos del snapshot, versiones y protección cohorte | PENDIENTE |
| G14 | REVIEWER/OWNER aprueba informes | Sólo roles habilitados; auditoría | PENDIENTE |
| G15 | OWNER distribuye a buzones locales de prueba | Mailpit: un envío por destinatario; reintento solo fallidos | PENDIENTE |
| G16 | BILLING_ADMIN consulta uso e invoices | Consumo y export real; costes ocultos al rol no financiero | PENDIENTE |
| G17 | OWNER crea y responde ticket demo | Ticket y mensajes coinciden en Support y Workspace | PENDIENTE |
| G18 | ES/EN, claro/oscuro, 390/768/1440 px | Sin desbordes ni controles sin contraste; iconografía sin texto | PENDIENTE |
| G19 | Tablas y paginación | 25/50/100, filtros y total real; scrollbar preservado | PENDIENTE |
| G20 | Teclado y lector de pantalla | Foco visible, nombre accesible y estado de carga | PENDIENTE |

**No usar correos reales ni datos productivos en los gates destructivos o que envían notificaciones.** Crear fixtures de demo para los flujos de escritura.

## 6. Qué falta para certificar WS-5

Pasan pruebas automatizadas de regresión; la certificación final requiere evidencias de typecheck/build local, smoke contra servicios iniciados, piloto E2E y revisión real de los 20 gates. No se declara completado el QA E2E, cumplimiento WCAG ni preparación productiva con la simple existencia de código o tests estáticos.

## 7. Siguiente decisión

Si los comandos locales pasan y los gates manuales no revelan incidencias, registrar WS-5 como cerrado para el Workspace en entorno local. Los servicios de pagos externos y certificación productiva permanecen fuera de esta etapa.
