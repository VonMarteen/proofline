# PROOFLINE — Workspace R7 · KPI compactos y hover de exclusión
Fecha: 23/10/2026

## Base y alcance
- Aplicar **exclusivamente sobre R6 validado**, que a su vez incluye R5, R4 y R3.
- Patch incremental, NO es el repositorio completo.
- Detener Workspace antes de copiar. Hacer copia/commit local de los dos archivos existentes que cambia R7.
- La versión de referencia es el árbol reconstruido de `PROOFLINE_ESTADO_REAL_20261023-001019.zip` más R3, R4, R5, R6.

## Cambios
1. Dashboard `Resumen`: cuatro KPI con iconografía real, legible y no interactiva (aria-hidden), el icono a la izquierda, etiqueta y cifra en una misma línea, nota inmediatamente debajo. Datos: **sin cambios**. 2 columnas a <=1120 px, una a <=580 px.
2. `Plan, uso y facturación`: los seis KPI conservan sus datos y su único renglón en escritorio amplio; icono a la izquierda y tres líneas compactas de contenido a la derecha. Sin tocar sus componentes, rutas ni fuentes de datos.
3. Botón `Excluir`: estados visuales mutuamente coherentes y accesibles. Estado inactivo/hover: monocromático neutro. Estado excluido/hover: rojo. **No se modifica** `aria-pressed`, la lista de exclusiones, las casillas ni su guardado.

## Archivos de código modificados
- `apps/web/app/[locale]/page.tsx` — SOLO las cuatro tarjetas KPI y el import de Icon.
- `apps/web/app/layout.tsx` — import al final del nuevo estilo R7.
- `apps/web/app/workspace-r7-kpi-exclusion.css` — nuevo, acotado a los KPI y Excluir.
- `tests/workspace-r7-kpis-exclusion.test.mjs` — nuevo.
Ningún otro archivo existente cambia. En concreto API, Control, Prisma, worker, pagos, persistencia, CSS global y G1 permanecen intactos.

## Comprobaciones realizadas en entorno de análisis
- Node 22: 293/293 tests acumulados, con `--experimental-strip-types` y desde raíz.
- R7: 7/7 tests nuevos.
- Static audit: 377 archivos, OK.
- TypeScript: transpile sintáctico de `page.tsx` y `layout.tsx`, sin errores.
- Chromium: fixture aislado compuesto con CSS real, geometría a 1650, 1440, 1280, 1080, 720 y 390 px, sin desbordamiento horizontal. Colores computados del botón hover sin mezcla de violeta y rojo.
- **NO** se ha compilado Next con dependencias ni ejecutado E2E en tu Windows/servidores.

## Instalación
1. Detener los procesos del Workspace.
2. Descomprimir este ZIP directamente en `C:\Users\aruma\Desktop\PROOFLINE`, conservando rutas.
3. En la raíz ejecutar:
```
node --test tests/workspace-r7-kpis-exclusion.test.mjs
pnpm typecheck
pnpm build
```
4. Reiniciar con `Proofline: 2 · ARRANCAR TODO`. Si se ven los estilos antiguos, confirmar que se ha reiniciado completamente Next; no borrar datos ni bases de datos.
5. Validar ES/EN y claro/oscuro: Resumen KPI, Facturación KPI, Excluir normal/hover/excluida/hover, guardar población y recargar para comprobar persistencia.

## Reversión
Restaurar `apps/web/app/[locale]/page.tsx` y `apps/web/app/layout.tsx` del respaldo R6. Eliminar `apps/web/app/workspace-r7-kpi-exclusion.css` y el test R7. No es necesario tocar datos.

## Siguiente puerta funcional
G1 (lanzamiento/ledger; cierre/trabajo analítico; estado de aprobación; versiones concurrentes) sigue abierto y debe tratarse de forma independiente, con datos aislados y pruebas funcionales.
