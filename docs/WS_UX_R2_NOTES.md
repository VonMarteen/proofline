# PROOFLINE WS-UX-R2 · Densidad del assessment y previsualizaciones

## Alcance

- Pantalla de detalle del assessment: composición, estado, constructor y selección de población.
- Constructor: ancho de tipo, dimensión, enteros min/max/step, opciones y botón de añadir; filas de preguntas existentes.
- Previsualización del participante: espaciado, tamaños, saltos de texto y escala.
- Informe: evitar colisiones entre etiquetas, cifras y barras; adaptar 1440 / 1024 / 390 px.

## Preservación

Sin modificaciones en API, estado de assessments, confirmaciones, permisos, cálculo, PDFs, Prisma, persistencia, rutas, tema, navegación, scrollbars o Control. No se añaden funciones simuladas. Los selectores CSS están acotados a la pantalla de assessment y sus previsualizaciones.

## Comprobación

1. Abrir un assessment editable, alternar SINGLE/MULTI/LIKERT/RANGE/MATRIX. Confirmar tamaños proporcionales sin campos gigantes.
2. Guardar una pregunta, editarla, reordenarla y comprobar que no cambia el contenido del registro.
3. En población, navegar páginas, seleccionar personas y excluir una; guardar y recargar la página. Verificar contadores y selección.
4. Previsualizar el assessment y el informe (datos sintéticos). Inspeccionar 1440px, 1024px y 390px; no debe haber solapamiento de etiquetas, barras, valores ni scroll horizontal de documento.
5. Comprobar colores y tamaño de controles en temas claro y oscuro; verificar que Control mantiene sus scrollbars y tarjetas.
6. Ejecutar `node --test tests/workspace-ux-r2-density-preview.test.mjs`, `pnpm typecheck`, `pnpm build`.

Nota: las pruebas estáticas de Node no equivalen a una comprobación visual real ni a la validación E2E en Windows. No instalar si la base real difiere de WS5+R1; comparar antes el diferencial.
