# PROOFLINE · Workspace R6 — Botones, roles y densidad de facturación
Fecha: 23/10/2026

## Requisito de instalación
**Base obligatoria: R5** (`PROOFLINE_WORKSPACE_ASSESSMENT_R5_COMPACTACION_20261023.zip`) sobre R4/R3 en el estado aprobado.

Extraer los archivos del ZIP en `C:\Users\aruma\Desktop\PROOFLINE` conservando rutas, con el proyecto detenido. **Este ZIP es incremental, NO reemplaza el repositorio.** Haz una copia o commit local antes de sobrescribir archivos.

## Cambios
- Assessment: botones Editar/Eliminar con superficie, padding, contraste, hover/focus; idénticos handlers y confirmación de eliminación. Botón Excluir con espacio dentro de la fila y estado visual actual accesible.
- Equipo: cabecera completa por encima de ambas columnas; tabla y alta de usuario alineadas en la misma fila; Quitar es un botón visible con confirmación existente.
- Roles: nombre del rol y descripción en paralelo; inspector Puede/No puede con transición discreta, panel siempre montado y `aria-hidden` cuando está cerrado; estado y permisos existentes inalterados.
- Facturación: seis KPIs de datos reales en una sola fila si viewport >1360px, cada uno con icono real de Proofline; en menores anchuras 3/2/1 según espacio. Tres campos de cambio de tarjeta en una línea si ancho >980px, respuestas por proveedor dinámicas sin modificar el payload.
- Privacidad: Revisar renderiza un enlace real con apariencia de botón y separación interna.

## Código modificado
Solo TSX de presentación y estilos de `apps/web`, más una prueba nueva. **No cambia** API/Prisma/worker, contratos, endpoints, scoring, estados, permisos, contenido de pago ni datos.

## Validación en Windows (PowerShell desde raíz)
```
node --test tests/workspace-r6-actions-layout.test.mjs
pnpm typecheck
pnpm build
```
Reinicia **Proofline: 2 · ARRANCAR TODO**. Comprueba páginas en ES/EN y tema claro/oscuro:
1. Assessment en edición: Editar abre editor; Eliminar pide confirmación; Cancelar no elimina.
2. Población: Excluir/Excluida refleja selección y persiste tras guardar y volver a abrir.
3. Equipo: el encabezado ocupa ancho; tabla y alta alineadas; Quitar confirma; roles y alcance responden igual.
4. Roles: seleccionar cada rol muestra sus datos; Puede/No puede se abren y cierran con teclado.
5. Facturación: seis KPIs reales en fila ancha, tres controles de Redsys; cambiar a PayPal/transferencia muestra sus propios campos y guardado sigue pendiente de validación.
6. Privacidad: Revisar abre el assessment correspondiente, no modifica datos.

## Cobertura y límites
En entorno de análisis: 286/286 pruebas de Node + auditoría estática 377 archivos; seis TSX transpilan sintácticamente; Chromium verificó geometría aislada a 1650, 1440, 1280, 1080, 720 y 390 px. **Esto no sustituye** `pnpm typecheck`, `pnpm build` ni una revisión integrada E2E en tu Windows.

## Reversión
Restaurar los seis TSX desde el backup R5, eliminar `apps/web/app/workspace-r6-actions-density.css` y su `import` en `apps/web/app/layout.tsx`. El nuevo test se puede borrar. No modificar la base de datos.

## Trabajo NO incluido
**G1 — cierre de integridad funcional:** lanzamiento sin ledger, cierre y trabajo analítico, aprobación de informes y control concurrente de versiones; sigue pendiente de implementación/probatorio de BD aislada. No se ha mezclado con un retoque visual.
