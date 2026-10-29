# PROOFLINE CONTROL — UX-A2 · Rendimiento y diagnósticos

Fecha: 20/10/2026 · Incremental **sobre P7 + UX-A1 + UI-01 + UI-01R**.

## Alcance y compatibilidad

1. Dashboard y Negocio: el cambio entre las métricas del mismo gráfico pasa a ser local, sobre el resultado ya autorizado y cargado. No pide otra vez el Dashboard ni fuerza navegación. Se actualiza el parámetro `metric` con History API; el cambio de **7/30/90/365 días sigue solicitando nuevos datos reales**.
2. Configuración: usa `view=ui` para no descargar todos los entitlements que no se muestran. El endpoint sin parámetro sigue devolviendo el contrato completo (incluido `entitlements`) para `runtime:check` y otros consumidores.
3. Seguridad: las consultas independientes se ejecutan en paralelo. Solo se recuperan datos mínimos de sesiones/dispositivos para el recuento; los eventos de auditoría retienen su contrato de datos. Permisos y RBAC sin cambios.
4. Dashboard API: reduce el peso de cada registro de facturas, suscripciones, uso, tickets, jobs, análisis y usuarios. Se conservan fuentes, reglas financieras, filtros de permisos y estructura de salida.
5. Diagnóstico: si un Dashboard supera 1000 ms, la API muestra `[CONTROL] dashboard slow response: ...; dbBatch=...ms; health=...ms`. Si la comunicación Control->API supera 1000 ms, Next.js imprime `[CONTROL UI] slow GET /ruta: ...ms; HTTP ...`, nunca el token ni el query string.
6. La UI/tema/scrollbars/espaciado/sidebar de UI-01R no se rediseñan. CSS añadido **únicamente** para que los botones de series reproduzcan el estilo anterior de las pestañas.

## Comprobaciones realizadas aquí

- 77/77 pruebas de código disponibles (`node --experimental-strip-types --test tests/*.test.mjs`, con TypeScript en NODE_PATH). Incluyen 7 comprobaciones específicas UX-A2 y pruebas previas de P2–P7 y UI-01R.
- Sintaxis de los 8 TS/TSX modificados verificada con TypeScript `transpileModule`.
- No se ejecutaron `pnpm typecheck`, `pnpm build`, `runtime:check`, Pilot E2E ni pruebas en navegador real con base de datos: el snapshot no contiene `node_modules`, PostgreSQL ni servicios activos.

## Certificación en Windows después de instalar

Desde la raíz de PROOFLINE, arrancar servicios con **Proofline: 2 · ARRANCAR TODO**, luego ejecutar:

```powershell
pnpm control:uxa2:check
pnpm control:p3:check
pnpm control:p7:check
pnpm typecheck
pnpm build
pnpm services:check
pnpm runtime:check
pnpm pilot:check
```

1. Abrir Dashboard en `30d`. Alternar **Facturas pagadas / Facturas emitidas / Altas / Tickets**: el gráfico debe responder sin nueva petición a `/v1/control/backoffice/dashboard` en Network.
2. Alternar `7d -> 30d -> 90d -> 365d -> 7d` y registrar duración y los logs `[CONTROL]` / `[CONTROL UI]` si superan 1 s. No se afirma que el timeout del piloto ni los 15–20 segundos observados estén resueltos sin medición.
3. Abrir Configuración y Seguridad; comprobar que cargan y conservan las opciones y registros. Cambiar idioma de una organización de pruebas y verificar persistencia/auditoría solo si se desea ejecutar una operación real.
4. Revisar que scrollbars, cuatro KPI compactas, navegación, tablas y ES/EN permanecen intactos.
5. Si un request supera cinco segundos y aparece error, enviar únicamente la ruta y tiempos de los logs (sin token, credenciales ni datos personales).

## Condiciones pendientes

- Rendimiento validado en el equipo del usuario (incluye métricas por tamaño de base de datos).
- Certificación integral de `pilot:check` del plan anterior.
- QA de todos los recorridos funcionales y lanzamiento productivo.

**No declarar UX-A2 completamente certificado ni producción READY hasta superar estas comprobaciones locales.**
