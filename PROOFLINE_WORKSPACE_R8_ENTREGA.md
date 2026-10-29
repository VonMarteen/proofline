# PROOFLINE Workspace R8 — Homogeneidad visual acotada

**Base necesaria:** R7 (`PROOFLINE_WORKSPACE_R7_KPI_HOVER_20261023.zip`) aplicado y validado.
**Alcance:** componentes Workspace, exclusivamente; no actualiza API, Prisma, Control ni operaciones.

## Cambios

1. **Personas y organización:** seis controles visibles de barra superior (`buscar`, `área`, `Filtrar`, `Importar CSV / Excel`, `Nueva área`, `Añadir persona`) con caja real de 38 px, altura homogénea; se corrige la rejilla de filtros para tres elementos visibles. Los `GET` y `POST` siguen iguales.
2. **Privacidad y cumplimiento:** cuatro indicadores con iconografía ya incluida en `@proofline/ui`, etiqueta y valor sobre una sola línea. Mantiene `approvedCount`, `legalHolds.length`, `documents.length` y `retentionPolicies.length`, todos de API; textos en ES/EN.
3. **Workspace sidebar:** el grupo que contiene la ruta activa se muestra enmarcado, de forma análoga a Control; la ruta activa mantiene su resaltado. La lógica de roles (`WorkspaceNav`) no se ha alterado. Cabecera, pie y scrollbar siguen idénticos.

## Archivo de estilos
`apps/web/app/workspace-r8-parity.css`: importado **después de R7** por `apps/web/app/layout.tsx`. Selectores de directorio/KPI/siderbar acotados; breakpoints 1290/900/690/480 px.

## Pruebas ejecutadas aquí
- `node --experimental-strip-types --test tests/*.test.mjs`: **301/301** correctas.
- `node scripts/static-audit.mjs`: **377 archivos fuente** revisados correctamente.
- TypeScript: transpile sin errores de sintaxis en `legal/page.tsx` y `layout.tsx`.
- Chromium en fixture aislado con CSS real, 1650/1440/1280/1080/900/720/390 px: controles medidos **38 px**, iconos alineados, contenedor de navegación activo con borde, sin overflow horizontal. Un fixture **no equivale al navegador real con Next**.

## Instalación
1. Con el proyecto detenido, extraer el ZIP sobre `C:\Users\aruma\Desktop\PROOFLINE` **sin eliminar carpetas**.
2. En PowerShell desde la raíz:
```powershell
node --test tests/workspace-r8-consistency.test.mjs
pnpm typecheck
pnpm build
```
3. Reiniciar con `Proofline: 2 · ARRANCAR TODO`, actualizar navegador y revisar las tres vistas en ES/EN, claro/oscuro, escritorio y móvil.
4. **Prueba funcional:** buscar/filtrar personas; cambiar de categoría activa en el menú y comprobar permisos; consultar Privacidad sin diferencias en datos.

## Reversión
Eliminar `workspace-r8-parity.css` y su import en `apps/web/app/layout.tsx`; restaurar `apps/web/app/[locale]/legal/page.tsx` de R7 si fuera necesario. **No tocar base de datos ni migraciones.**

## Limitaciones
Aquí no se han ejecutado `pnpm build`, servicios ni E2E de tu instalación Windows. G1 queda pendiente como flujo independiente para evitar mezclar riesgos de integridad con el ajuste de presentación R8.
