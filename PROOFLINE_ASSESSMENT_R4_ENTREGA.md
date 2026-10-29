# PROOFLINE — Assessment UX R4 · Constructor, población y privacidad

**Fecha:** 23/10/2026  
**Base obligatoria:** snapshot real `PROOFLINE_ESTADO_REAL_20261023-001019.zip` + entrega `PROOFLINE_WORKSPACE_UI_R3_IMPLEMENTACION_7_PANTALLAS_20261023.zip` aplicada.  
**Tipo:** ZIP incremental acotado a `apps/web` (Workspace), sin cambios API, esquema de DB o Control.

## Alcance concreto

1. **Preparar, revisar y lanzar.** Margen y separación explícitos entre explicación, chips de requisitos, advertencia y acciones.
2. **Constructor de pregunta.** El campo de enunciado aprovecha todo el ancho. Tipo de respuesta y dimensión se sitúan junto a la configuración específica del tipo. Configuración de mínimo, máximo y paso reducida a tamaños proporcionales. Opciones avanzadas, mensajes y botón de guardado conservados. Sin ancho máximo arbitrario de 850 px en esta pantalla.
3. **Población como único conjunto.** Sección «Población del assessment» con dos subzonas paralelas: «Organización y áreas» y «Personas concretas / Exclusiones individuales». La lógica original combina el alcance de organización/áreas con inclusiones y exclusiones específicas. Se mantienen búsqueda, selección, recuento previo, paginación, confirmación de guardado, API y estado congelado.
4. **Privacidad y aviso.** Sección independiente a ancho completo, *debajo de población*. Se mantienen controller, finalidad, base, retención, confidencialidad, aprobación, aviso versionado y prevención de pérdida de cambios.
5. **Responsive.** 2 columnas en escritorio; 1 columna para población hasta 1150 px y para el constructor hasta 850 px; campos apilados en móvil.

## Archivos afectados

- `apps/web/app/[locale]/assessments/[id]/page.tsx`
- `apps/web/components/question-editor.tsx`
- `apps/web/components/population-editor.tsx`
- `apps/web/app/layout.tsx` (solo import del nuevo CSS)
- `apps/web/app/assessment-detail-r4.css` (nuevo; estilos circunscritos a `.workspace-assessment-detail-page`)
- `tests/workspace-assessment-r4-layout.test.mjs` (nuevo)

No tocar `apps/api`, `apps/control`, Prisma, navegaciones, permisos RBAC, scoring, ledger ni estilos de otras rutas.

## Validación local ya realizada

- `node --experimental-strip-types --test tests/*.test.mjs`: **269/269**.
- `node scripts/static-audit.mjs`: **377** fuentes OK.
- TSX modificado: parse/transpilación **4/4** sin diagnósticos de sintaxis.
- Chromium: muestra representativa de DOM+CSS a **1500, 1080, 720 y 390 px**. Verificados anchos, orden vertical de secciones y ausencia de scroll horizontal. **No** constituye E2E ni screenshot renderizado por Next del entorno del usuario.

## Instalación Windows

1. Haz copia G0 del estado actual según el procedimiento de G0/G1, si aún no la has creado.
2. Extrae el ZIP **sobre la raíz de PROOFLINE**, manteniendo carpetas. No borres los archivos existentes ni sustituyas `node_modules`, base de datos o `.env`.
3. Ejecuta desde la raíz:

```powershell
node --test tests/workspace-assessment-r4-layout.test.mjs
pnpm typecheck
pnpm build
```

4. Detén por completo los procesos web de Next y arranca con `Proofline: 2 · ARRANCAR TODO`.
5. En `http://localhost:4202/es/assessments/<id>` de un assessment de preparación/revisión, comprueba:
   - El encabezado de verificación no pega la advertencia a los checks.
   - Prompt de pregunta ocupa todo el ancho. Tipo/dimensión y min/max/step quedan en zona de configuración paralela.
   - Añadir, editar y eliminar preguntas se conservan (eliminar exige confirmación).
   - Organización/áreas queda a la izquierda y búsqueda de personas/exclusiones a la derecha en escritorio. Comprueba **inclusión y exclusión**, recuento, confirmación y guardado real.
   - «Privacidad y aviso al participante» queda debajo de la población ocupando el ancho del panel.
   - En móvil, no se superponen campos ni aparece scroll horizontal.
   - Validar roles sin capacidad de editar y assessments lanzados/cerrados (bloqueo y lectura).

## Reversión

Si la compilación o alguna operación presenta un problema, revierte exclusivamente los cuatro archivos existentes enumerados arriba desde tu copia G0, borra `apps/web/app/assessment-detail-r4.css` y su import del layout, y elimina la prueba nueva. No reviertas código de otras superficies. Documenta el error exacto antes de aplicar otra corrección.

## Fuera de alcance

No se corrigen los problemas estructurales de G1 (atomicidad y estados de informes): permanecen pendientes de certificación sobre base aislada. Esta entrega no introduce funcionalidades nuevas, solo mejora la organización visual de una pantalla existente.
