# PROOFLINE Control — UI-01 · normalización de densidad y consultas
Fecha: 19 de octubre de 2026
Base: AUDIT 20261019-1651 + parches P7 + UX-A1.

## Alcance: cambio incremental

- Capa CSS aditiva en `apps/control/app/backoffice.css`: proporción de tarjetas KPI, layout y ritmos compartidos, escalas tipográficas, acciones y controles a 36px, estados de foco, scrollbars y tamaños adaptables.
- Sistema: cinco tarjetas compactas en una fila con espacio disponible, reflujo a tres, dos o una según anchura.
- Configuración, formularios de retención, legales y creación de usuario: controles y botones alineados; ajustar según contenido, no mínimos arbitrarios.
- Marketplace, Assessments y tablas existentes: densidad KPI corregida, filtros/acciones compactos; conservan la paginación del servidor ya implementada en P2–P6.
- Dashboard: la actividad privilegiada reciente tiene búsqueda, orden y paginación sobre los eventos cargados; se mantiene enlace a Auditoría para consultar el histórico.
- Legal & Trust: evitar paneles verticalmente estirados; versionado y publicación originales preservados; dry run (máximo 50) y evidencias recientes con controles reales sobre filas obtenidas.
- Privacidad: archivo documental buscable y paginado sobre `records` devueltos; políticas/holds conservan sus acciones originales.
- Seguridad: matriz RBAC, usuarios internos y actividad reciente con filtros, búsqueda y paginación sobre filas devueltas por API.
- Comunicaciones: dos columnas intrínsecas, sin scrollbar fuera de diseño; entregas/Outbox con búsqueda, filtros y paginación sobre los eventos cargados.
- Planes: capacidades efectivas en pares clave/valor, evitando JSON como interfaz principal; detalle técnico expandible, formulario de alta en retícula coherente.
- No se modifican API, datos, permisos, facturación, persistencia ni infraestructura.

## Límite importante de alcance de las tablas

Las consultas nuevas de UI-01 son **filtros reales en cliente exclusivamente sobre registros ya cargados**. En listados de eventos recientes, comunicaciones y legal pueden existir registros adicionales fuera del lote servido por API. Se indica la limitación cerca de cada tabla. No se simula paginación completa de base de datos. En Assessments, Marketplace, Informes, Procesos recientes y otros listados P2–P6 sigue usándose paginación backend anterior, no se convierte a local.

Para completar consultas de histórico masivo en Legal, Privacidad, Seguridad y Comunicaciones, corresponde una fase backend independiente, previa definición de filtros soportados, permisos, índices y conteos; no se amplía silenciosamente este parche visual.

## QA ejecutado en entorno de análisis

- `node --experimental-strip-types --test` de las suites P2–P7, UX-A1 y UI-01: 66/66 correctas (Node 22 local de análisis; suites P2–P6 conservadas).
- Sintaxis TS/TSX revisada mediante TypeScript `transpileModule` de los componentes y páginas modificados (sin errores sintácticos).
- Nuevos 8 tests UI-01: filtrado, búsqueda sin acentos, orden inmutable, páginas 25/50/100 y contratos de componentes y pantallas.

## Pendiente de certificar en Windows antes de considerar cerrado

1. Instalar ZIP incremental encima de base local que tenga P7 y UX-A1.
2. `pnpm control:ui01:check`
3. `pnpm control:visual:check`
4. `pnpm control:p7:check`
5. `pnpm typecheck`
6. `pnpm build`
7. Arrancar con tarea VS Code habitual, inspeccionar Sistema (>= 1281px), Dashboard, Assessments, Marketplace, Planes, Configuración, Legal, Privacidad, Seguridad, Comunicaciones en temas claro/oscuro y tamaños 1920/1440/1024/390.
8. Comprobar filtros cliente sobre datos devueltos y acciones de crear usuario / legal hold / guardar idioma con la cuenta autorizada; no ejecutar retenciones destructivas en datos reales para QA visual.
9. Pilot E2E sigue pendiente por timeout previo; velocidad Dashboard y consultas locales continúan pendientes de medida runtime.

**Estado:** parche producido y tests de lógica/sintaxis superados; NO certificado visualmente en navegador ni en producción. No se deben inventar validaciones de runtime, RBAC o resultados manuales.
