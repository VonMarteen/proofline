# PROOFLINE — WS5-FINAL · Coherencia visual Control/Workspace + gate QA

Fecha de corte: 22/10/2026. Base: snapshot 19/10 + secuencia de parches aprobados hasta Workspace WS5, incluido el hotfix de iconografía sin textos.

## Directiva máxima

NO ALTERAR LO QUE YA FUNCIONA. Esta entrega no modifica API, Prisma, migraciones, scoring, informes, datos, RBAC, navegación de Control, scrollbars ni el tema. Los cambios UI afectan exclusivamente a la presentación descrita debajo.

## 1. Control — borde superior sutil

En `apps/control/app/backoffice.css` se modifica únicamente el color del borde superior de `.bo-section`, `.control-panel`, `.card` y `.bo-kpi` de estado neutro, restringidos a `.control-main`.

- No se modifica el grosor del borde, dimensión, padding, grid, posición ni scrollbars.
- Los KPI `.good` y `.danger` conservan sus colores semánticos.
- El tema claro/oscuro deriva el color del token existente `--border-strong`.

## 2. Workspace — menú agrupado por categorías

En `apps/web/components/workspace-nav.tsx`, las rutas **ya existentes** se agrupan en:

- GENERAL: Resumen.
- ASSESSMENTS: Assessments, Library/Marketplace, Informes.
- ORGANIZACIÓN: Personas y organización, Equipo y permisos, Identidad de organización.
- GESTIÓN: Plan y facturación, Privacidad y cumplimiento, Soporte.

En inglés: GENERAL, ASSESSMENTS, ORGANIZATION, MANAGEMENT.

Los 10 enlaces y sus permisos originales se preservan sin cambios. Los grupos sin enlaces permitidos no se muestran. La cabecera y usuario quedan fuera del contenedor desplazable de escritorio, y el patrón funciona también en el menú móvil existente. Los enlaces de detalle heredan el estado activo de su sección.

CSS: `apps/web/app/workspace.css`; alcance restringido a `.workspace-nav-group`, `workspace-nav-group-title`, items y variante móvil. No redefine scrollbar ni la navegación del Superadmin.

## 3. Avance WS5: certificación sin falsos positivos

Nuevo comando **seguro por defecto**:

```powershell
pnpm workspace:ws5:gate:check
pnpm workspace:ws5:visual:check
pnpm workspace:ws5:gate
```

El gate sin argumentos solo realiza pruebas automatizadas y consultas **GET** en loopback (usa `workspace-ws5-readonly-smoke.mjs`). No crea assessments ni modifica informes.

Para una certificación local más completa (⚠ **puede generar datos de prueba** en la base de datos local), en un entorno NO productivo:

```powershell
pnpm workspace:ws5:gate:full
```

Incluye Typecheck, Build, Services, Runtime y Pilot. Los gates marcan `PENDING` si los tests devuelven `[PENDIENTE]` o `NO CERTIFICADO`, aun con exit code 0. Un gate local completo **no equivale** a certificación productiva, ni garantiza la experiencia manual en navegador.

El reporte no incluye salidas HTTP ni credenciales; solo pasos, estados y duraciones. Se guarda en `.runtime/workspace-ws5-gate-latest.json`.

## 4. Verificaciones ejecutadas aquí

- `node --experimental-strip-types --test tests/*.test.mjs`: **234/234 PASS** en entorno reconstruido Linux Node 22.
- Incluye pruebas de comportamiento simulando el componente React/Next de Workspace para roles OWNER, ADMIN, BILLING_ADMIN y VIEWER, grupos ES/EN, URL activa y continuidad del scroll.
- Gate de QA: casos de éxito, fallo, pendiente y no certificación productiva.
- No se ha ejecutado `pnpm typecheck` o `pnpm build` por no disponer de las dependencias completas del monorepo en este entorno.
- No se ha probado un navegador autenticado con la base PostgreSQL local de Windows ni `pilot:check` en esta entrega.

## 5. Criterios manuales de aceptación

1. Control: borde superior sutil en las tarjetas principales; tamaños y KPI sin cambios; no hay alteración de scrollbars.
2. Workspace: categorías visibles ES/EN y menús correctos para OWNER, ADMIN, BILLING_ADMIN y VIEWER.
3. Workspace: cabecera, selector de organización, estado activo, pie de usuario y logout funcionan igual.
4. Workspace: el menú solo hace scroll en enlaces en desktop y se adapta a móvil.
5. Web comercial, Support y Respond se mantienen intactos.
6. Verificar el gate seguro y dejar explícitos los pendientes del E2E.

## 6. Notas de integración

Extraer el único ZIP incremental desde la raíz `C:\Users\aruma\Desktop\PROOFLINE`, conservando rutas. No requiere Prisma generate, migrations ni actualización de dependencias.
