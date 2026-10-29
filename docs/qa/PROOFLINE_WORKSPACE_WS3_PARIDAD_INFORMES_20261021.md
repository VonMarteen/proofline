# PROOFLINE — WS-3 · Paridad visual del Workspace y evidencia de informes

## Fuente de evaluación

Vídeo del usuario `20261020-2353-19.1861598.mp4` (68,2 s, 1908 × 1018). En 00:00–00:10 se ve Proofline Control, a partir de ~00:12 el Workspace de ACME Europe, y al final vuelve a Control.

## Cambios funcionales realizados

1. **Detalle de informe individual:** `GET /v1/workspace/reports/:id` usa `permittedAssessmentIds`, valida la capacidad `results.read`/`results.authorized_read`, restringe por `organizationId` y las concesiones del assessment. Devuelve solo ese informe, su snapshot y el estado documentado de sus entregas. No modifica el endpoint histórico `GET /v1/workspace/reports` ni las acciones de aprobación/distribución.
2. **Compatibilidad de snapshots:** la ficha interpreta `ReportEnvelope` (contrato canónico v2) y snapshots anteriores. Se muestran participación, índice general, dimensiones, resumen y huella almacenados; no se recalcula scoring ni se inventan conclusiones.
3. **Distribución verificable:** separación de borrador/aprobado/distribuido y de envíos pendientes/enviados/fallidos. Un estado `SENT` no acredita que el destinatario leyera el mensaje. Se conserva la descarga PDF real.
4. **Listado de informes:** etiqueta corregida de «entregados» a «enviados» para no sobreafirmar prueba de lectura.

## Paridad visual con Control

Los ajustes afectan exclusivamente a `apps/web/app/workspace.css` (capa aditiva final). Igualación aproximada de estructura, jerarquía tipográfica, altura/densidad de KPI, ancho útil, cabecera, espacio entre componentes y control de desplazamiento del menú lateral. El bug original era `.workspace-main{width:calc(100% - 230px)}` dentro de una grid que ya reserva 230px para el sidebar. Se corrige a 100% del ancho disponible.

**No** se modifican archivos de `apps/control`, `packages/design-tokens`, CSS global, Prisma, esquema, infraestructura, identidad, permisos RBAC, callbacks de escritura ni tratamiento de pagos. Tampoco se añaden estilos nuevos de scrollbar; el sistema ARMAR heredado permanece.

## Resultados ejecutados en el entorno de preparación

- `node --test tests/workspace-ws3-report-visual-contract.test.mjs`: **7/7**.
- Regresión completa del árbol reconstruido: **171/171** tests (`node --experimental-strip-types --test tests/*.mjs`, disponible en el Node 22 del entorno de revisión).
- Sintaxis de los TS/TSX modificados comprobada con TypeScript.
- Declaraciones TypeScript para el adaptador ESM verificadas con `tsc --noEmit`.
- `pnpm typecheck`, `pnpm build`, Worker, PostgreSQL y recorrido E2E **no ejecutados en este entorno**; hay que realizarlos en el equipo del usuario (Node 20.20.2).

## Instalación

Extraer este ZIP incremental sobre la **última versión validada (WS-2 + corrección TS2554)**, conservando las rutas. No reinstalar ni actualizar paquetes. Iniciar con `Proofline: 2 · ARRANCAR TODO`.

Comandos:

```powershell
pnpm workspace:ws3:check
pnpm workspace:ws2:check
pnpm workspace:ws1:check
pnpm typecheck
pnpm build
pnpm services:check
```

## QA manual / aceptación

- En 1920/1440/1024 px: comparar con Control el ancho del contenido, cabecera, tarjetas KPI y densidad. El Workspace **no** debe terminar 230 px antes del borde disponible.
- Sidebar desktop: logo y cuenta permanecen visibles; solo enlaces internos se desplazan. El scrollbar mantiene los colores y estilo globales. No hay scroll horizontal del shell.
- En 390 px: un único contenido sin desbordamiento de controles; la navegación móvil se conserva.
- Abrir una ficha con snapshot canónico nuevo y otra histórica: cifras y resumen coinciden con el PDF/datos guardados; un campo ausente se muestra `—`, no se inventa.
- Un usuario sin permiso `results.read` o `results.authorized_read` no accede al detalle. Una organización o assessment ajeno tampoco.
- Comprobar distribución con entregas SENT/PENDING/FAILED; la ficha distingue enviados de entregados/leídos.
- Validar ES/EN y ambos temas. Abrir informes, previsualizar y descargar PDF, sin cambiar los procesos actuales de aprobación/distribución.
- Pilot E2E y pruebas reales de participación/análisis/informes L1–L4 siguen como gate separado; **no se declara certificación productiva**.

## Directiva de no-regresión

La aceptación exige verificar por separado: Control (sin cambios), Sidebar/scrollbars, creación de assessments WS-1/WS-2, permisos y reportes existentes. En caso de fallo local, revertir únicamente los archivos de este ZIP; no sustituir carpetas enteras.
