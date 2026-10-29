# PROOFLINE Control — Auditoría visual y funcional del vídeo (19/10/2026)

**Fuente**: grabación 20261019-1700-56.6657421.mp4, 189,8 segundos, 1916×904.
**Código de referencia**: snapshot PROOFLINE_AUDIT_20261019-1651.zip + P7 incremental aplicado.
**Estado de la auditoría**: evidencias del vídeo y revisión estática. No se dispuso de PostgreSQL, API 4206, Node/pnpm del equipo Windows ni sesión autenticada en este entorno.

## Defectos confirmados / observados

| ID | Ubicación / tiempo aproximado | Evidencia | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| V01 | Dashboard, 0:18–1:18 | Cambios de rango tardan varios segundos; la navegación en periodos fuerza documentos nuevos por `<a href>` | P1 | Corregida navegación SPA; tiempo real por medir |
| V02 | Dashboard y Negocio, 0:18–1:25 | Selector 7/30/90/365 no iguala altura/jerarquía de Desde/Hasta | P2 | CSS ajustado |
| V03 | Clientes, Operaciones, Assessments, Marketplace, Planes, otras | Total aparece al pie izquierdo y selector Filas centrado, contrario al estándar acordado | P1 | CSS compartido corregido para tablas con PaginationBar dentro de `control-table-wrap` |
| V04 | Operaciones, aprox. 1:45–1:58 | Densidad divergente entre listas y espacios | P2 | Densidad base CSS homogeneizada, falta QA visual navegador |
| V05 | Sistema, 1:49–1:59 | Procesos recientes sin filtros ni paginación | P1 | Se añaden filtros y paginación de servidor reutilizando endpoint de operaciones |
| V06 | Seguridad / usuarios internos, 1:58–2:05 | Formulario Crear usuario interno comprimido | P2 | CSS responsive, separación y tamaños uniformes |
| V07 | Configuración, 2:08–2:16 | Error «Control no puede consultar la API» | P0 | Pendiente: falta detalle HTTP o timeout real; error boundary ofrece diagnóstico más preciso |
| V08 | Comunicaciones, 2:27–2:32 | Columnas con densidad asimétrica | P2 | Columnas de ancho equivalente y scroll de lista sin ocultar datos |
| V09 | Ventas y onboarding, 2:33–2:38 | Pocos elementos disponibles / pipeline vacío | P2 | Pendiente: comprobar datos del embudo y flujo comercial real, no se simulan oportunidades |
| V10 | Legal & Trust, 2:40–2:50 | Políticas de conservación y legal holds comprimidos, botones desbordados | P1 | Paneles a ancho completo, grillas responsive y controles 40px |
| V11 | Privacidad y retención, 2:50–2:57 | Tablas sin estructura homogénea / navegación operativa | P2 | Pendiente de paginación y filtros backend completos |
| V12 | Seguridad, 2:57–3:03 | Misma pantalla de error al cargar | P0 | Pendiente: 4206 puede devolver 4xx, 5xx o timeout; no atribuir causa sin detalle |

## Correcciones incluidas en el paquete UX-A1

1. `PeriodSwitch` y `MetricTabs` usan `next/link`; navegación cliente y sin precarga agresiva. No modifica cálculos ni cobros.
2. Sidebar conserva navegación SPA y no precarga veintitantas rutas de API. Las consultas siguen siendo autorizadas y reales.
3. Paginación compartida: selector filas abajo a la izquierda, navegación a la derecha y total de registros arriba de la tabla a la derecha. `customers` y `subscriptions` se ajustan al contenedor común.
4. `system`: procesos recientes con búsqueda por tipo, filtro de estado, paginación de servidor real 25/50/100 y preservación de filtros.
5. Formulario de usuarios internos, Legal/retención/holds, rango de fechas y Comunicaciones homogeneizados.
6. Error de página: distingue una respuesta HTTP de falta de permisos, timeout y falta de conexión. Detalle visible en desarrollo; en producción solo identificador de diagnóstico.
7. API Dashboard registra `dashboard slow response: <ms>; range=<r>` si tarda >1000 ms. No registra PII ni importes.

## Pendiente — UX-A2 (no declarado corregido)

**P0:** diagnosticar errores de Configuración y Seguridad tras reiniciar la API 4206 con P7 instalado. Abrir «Detalle técnico», copiar HTTP/timeout; revisar terminal API (no compartir cookies/tokens). Confirmar si el `controlGet` de 5 segundos agota el plazo y si el API compilado coincide con P7. Solo modificar la causa comprobada.

**P1:** medir tiempo hasta primer byte de Dashboard 7/30/90/365 y 3 transiciones del sidebar; diferenciar compilación Next en `dev`, coste de DB, probes, carga concurrente, tamaño de respuesta y caches autorizadas. No atribuir el retraso únicamente a SPA. Ver log de `dashboard slow response`.

**P1:** extender filtros + paginación real al inventario faltante: tablas de Legal & Trust (3), Privacidad (1), Seguridad (2), Organización detalle (3), y tablas subsidiarias de informes cuando proceda. Debe implementarse server-side con total verificable y respeto a permisos; no paginar arreglos truncados como si fueran el universo completo.

**P2:** revisión visual manual en 1440, 1920, 768 y 390 px, claro/oscuro, ES/EN, estados vacíos y con 1/25/100+ datos; navegación teclado y foco, scroll horizontal y botones con texto largo. Auditar pipeline comercial, permisos y origen de leads, sin crear datos ficticios.

## Certificación disponible

- Tests específicos P2–P7: **50/50**, ejecutados con Node 22 y strip-types en entorno de auditoría.
- Tests nuevos de regresión estática UX-A1: **8/8**.
- Sintaxis TypeScript/TSX de archivos modificados: verificada por `typescript.transpileModule` (no es `pnpm typecheck`).
- Pendiente Windows: `pnpm control:visual:check`, `pnpm control:p7:check`, `pnpm typecheck`, `pnpm build`, `pnpm runtime:check`, `pnpm services:check`, `pnpm pilot:check`; revisar Console/Network y el flujo E2E.

**No se declara Control finalizado, optimizado ni listo para producción sin estas verificaciones.**
