# PROOFLINE Control — UI-01R: hotfix de regresiones

**Base requerida:** snapshot del 19/10/2026 con P7, UX-A1 y UI-01 ya aplicados. Este archivo **no** contiene el proyecto completo ni reemplaza esas fases.

## Incidencias corregidas

1. **Scrollbar de navegación y página:** retiradas exclusivamente las declaraciones de UI-01 que sobrescribían `@proofline/design-tokens/base.css` (`scrollbar-color`, `scrollbar-width` y pseudo-elementos específicos). El diseño original usa degradado `--scrollbar-thumb-a` / `--scrollbar-thumb-b` en Chromium y una representación equivalente en Firefox. No se cambia la estructura de navegación ni la mecánica de desplazamiento.
2. **Tarjetas KPI del Dashboard:** las cuatro tarjetas iniciales usan una distribución compacta con icono junto al texto; los datos, diferencias, colores y fuentes permanecen inalterados. El estilo nuevo está estrictamente limitado a `.bo-dashboard > .bo-kpi-grid`, sin modificar tarjetas de Sistema, métricas de otros módulos ni consultas.
3. **Aviso React `unique key`:** se asigna la clave React en el `Fragment` externo de las celdas creadas como elementos JSX dentro de arrays. Corregido en Comunicaciones, Privacidad, Seguridad y Legal. Las claves de los elementos hijos no eran suficientes. Las APIs, el contenido y el filtrado no se modifican.

## Pruebas ejecutadas aquí

- `node --experimental-strip-types --test tests/control-ui01-regression-20261020.test.mjs tests/control-ui01-density-records.test.mjs tests/control-visual-audit-20261019.test.mjs`: **20/20**.
- Análisis/parsing + transpilación TypeScript de las 4 páginas TSX modificadas: **0 diagnósticos de sintaxis**.
- Chromium estático (CSS base + globals + backoffice + HTML de prueba; **no es el producto en ejecución**), viewport 1920px:
  - UI-01 anterior: primera tarjeta KPI **123px** y el `backgroundImage` del scrollbar de navegación era `none` (sobrescrito).
  - UI-01R: las cuatro tarjetas **78px** y el scrollbar vuelve al gradiente definido en los tokens de Proofline.
  - No hubo overflow horizontal en la prueba de escritorio.
- Esta revisión no ejecutó NestJS, Next.js, PostgreSQL, servicios de red ni la aplicación completa. Por tanto **no certifica** la desaparición del aviso React en la instalación local, ni Typecheck, Build, runtime/pilot y navegación real. Tampoco certifica el responsive de todo Control.

## Instalación

1. Antes de instalar, hacer una copia de los archivos que reemplaza el parche.
2. Descomprimir en la raíz de `C:\Users\aruma\Desktop\PROOFLINE`. **Conservar rutas internas**.
3. Iniciar desde VS Code: **Proofline: 2 · ARRANCAR TODO**. Si Next mantiene recursos obsoletos, primero detener el proceso Next correspondiente y arrancar nuevamente mediante la tarea habitual. No borrar base de datos ni credenciales.
4. Comprobar:

```powershell
node --test tests/control-ui01-regression-20261020.test.mjs
pnpm control:ui01:check
pnpm control:visual:check
pnpm typecheck
pnpm build
```

5. Revisar en el navegador el scroll de navegación, el scroll de página, las 4 tarjetas en Dashboard y Comunicaciones, Legal, Privacidad y Seguridad. Verificar DevTools sin el aviso `unique key`. Notificar fallos antes de continuar con UX-A2.

## Política de cambios

Parche incremental exclusivamente sobre código compartido de presentación y cuatro páginas UI-01 con claves React. Sin Prisma, APIs, permisos, worker, datos, infraestructura ni lógica comercial. **Prohibido declarar P7/UI-01 totalmente certificados con solo pruebas estáticas.**
