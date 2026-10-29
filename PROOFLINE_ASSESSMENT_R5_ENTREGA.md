# PROOFLINE — Assessment R5 · Compactación sin cambios de negocio

**Fecha:** 23/10/2026  
**Base:** R4 validado por el usuario, sobre R3 y el snapshot real `PROOFLINE_ESTADO_REAL_20261023-001019.zip`.  
**Alcance:** solamente `http://localhost:4202/{es|en}/assessments/[id]`.

## Implementación exacta

- Constructor de pregunta: para escala Likert/NPS y demás rangos, **Min, Max, Step, Etiqueta mínima, Etiqueta máxima** ocupan una banda horizontal común en escritorio. Se conservan los cinco controles originales y su transformación a configuración; no se cambian valores, validación, tipos ni scoring. En pantallas estrechas se adaptan en múltiples filas.
- Población → Organización y áreas: **nombre y cantidad de personas en una línea**; «Toda la organización activa» incluye su aclaración a la derecha.
- Población → Personas concretas: **nombre + área/puesto en paralelo**, con truncamiento visual adaptable; botón **Excluir/Excluida** con estados de color y `aria-pressed`, foco visible, transición discreta y `prefers-reduced-motion`. El mismo `exclude`/`toggle` y payload de guardado permanecen intactos; no se añade ni sustituye el checkbox «Incluir».
- Privacidad y aviso: **siete campos en dos filas (3 + 4)** en escritorio: Responsable, Participación, Confidencialidad; Finalidad, Base jurídica, Retención, DPO. Se mantienen los valores y la aprobación versionada original. En tablet pasa a dos columnas y en móvil, una.

## Archivos incluidos

1. `apps/web/components/question-editor.tsx` — solamente clases de la configuración tipo rango.
2. `apps/web/components/population-editor.tsx` — clases, distribución semántica y atributo accesible de Excluir.
3. `apps/web/components/legal-profile-editor.tsx` — clases para posicionamiento de los siete campos.
4. `apps/web/app/layout.tsx` — import de CSS R5 después de R4.
5. `apps/web/app/assessment-detail-r5.css` — **nuevo** y acotado a `.workspace-assessment-detail-page`.
6. `tests/workspace-assessment-r5-compact.test.mjs` — pruebas de regresión.
7. Este documento y el manifiesto de integridad.

**No** hay archivos de `apps/api`, `apps/control`, `apps/respond`, Prisma, worker, Analytics, G0/G1, pagos o navegación. El parche no introduce datos de demostración.

## Evidencias previas a la entrega

- `node --experimental-strip-types --test tests/*.test.mjs`: **276/276 OK** (R4 y R3 incluidos).
- `node scripts/static-audit.mjs`: **377 fuentes OK**.
- Transpilación sintáctica de **4 TSX** del paquete: OK.
- Chromium con DOM representativo y CSS reales (`workspace.css`, R3, R4, R5), anchuras **1500/1280/1080/720/390 px**: sin desbordamiento horizontal. Los cinco campos de escala y las dos filas de privacidad se verificaron en escritorio. **No es la aplicación Next corriendo ni E2E con base de datos**.

## Aplicación en Windows

1. Si no existe ya, genera/guarda el baseline G0 del código. No cambies PostgreSQL.
2. Extrae **el contenido del ZIP sobre la raíz** `C:\Users\aruma\Desktop\PROOFLINE`. Reemplaza únicamente los archivos incluidos.
3. Desde la raíz:

```powershell
node --test tests/workspace-assessment-r5-compact.test.mjs
pnpm typecheck
pnpm build
```

4. Detén el proceso web y reinicia **Proofline: 2 · ARRANCAR TODO**. Comprueba el assessment tanto en español como en inglés, y con una ventana estrecha.
5. Comprueba **añadir una pregunta, marcar un área, incluir/excluir persona, cancelar y confirmar guardar población, editar/guardar perfil legal** en un assessment sintético en preparación (no uno real lanzado).
6. Si algo falla, devuelve el resultado exacto del comando o pantalla; no apliques cambios en otros módulos.

## Estado de G1

**Separado y pendiente:** atomicidad del lanzamiento/cierre y transición de informes. Esta entrega no los toca. Solo deben abordarse con pruebas de inyección de error y base aislada; no se declararán cerrados por tests estáticos.
