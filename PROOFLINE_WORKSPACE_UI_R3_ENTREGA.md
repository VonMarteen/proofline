# PROOFLINE Workspace — R3 · Código real de siete propuestas visuales

**Base exacta:** `PROOFLINE_ESTADO_REAL_20261023-001019.zip` enviado por el usuario.
**Tipo:** ZIP incremental. Extraer en la raíz del proyecto. **Solo** cambia ocho archivos existentes del frontend Workspace, añade una capa CSS acotada a Workspace y una prueba automática. No hay cambios en API, Prisma, Control, Support (portal independiente), Respond, workers, infraestructura ni scoring.

## Cambios implementados

| Ruta Workspace | Resultado implementado |
|---|---|
| `/[locale]` Resumen | Cuatro KPIs compactos, tres tarjetas al mismo nivel (Portfolio / Atención / Assessment activo), plan y uso condensado, últimos assessments en filas legibles. Los enlaces y datos son los reales de `v1/dashboard`. |
| `/[locale]/directory` Personas y organización | Nombre y email en celdas distintas, estructura lateral más estrecha, cabecera/filtros alineados, filas compactas, paginador conservado. |
| `/[locale]/team` Equipo y permisos | Nombre y email separados; tabla de miembros compacta, formulario de invitación alineado, siete roles agrupados en lista y panel lateral de capacidades `Puede / No puede` desplegable. Roles, permisos y confirmaciones originales intactos. |
| `/[locale]/branding` Identidad | Selector de color integrado en un único control, panel de vista previa estrecho, legibilidad/contraste compactados. Validación WCAG y guardado actuales intactos. |
| `/[locale]/billing` Plan y facturación | Seis KPIs en formato compacto con valores reales: uso, allowance, tarifa, facturas existentes, eventos de uso filtrados y estado del plan. Método de pago, facturas, ledger y paginación compactados. |
| `/[locale]/legal` Privacidad | Cuatro KPIs, assessments como filas con columnas para cinco valores en una única línea, cinco políticas en una fila si hay ancho suficiente, documentos conservados. |
| `/[locale]/support` Soporte | Tres paneles superiores: creación de ticket, solicitud contractual (si rol permite), y resumen real de tickets. Historial y paginación más compactos. |

### Reglas globales

- Tamaños y espacios más contenidos solo dentro del Workspace, con adaptación a móvil y scroll horizontal en tablas muy anchas.
- `Filas` junto al contador, abajo a la izquierda; página y navegación a la derecha. En páginas de tabla se añade referencia `Página X de Y` arriba a la derecha.
- No se han creado datos ficticios. No hay columna de teléfono porque el DTO actual del directorio no la suministra.
- No se han copiado del diseño gráfico KPIs de crecimiento, últimas actualizaciones, fechas de renovación, descargas masivas o acciones «…» sin su correspondiente funcionalidad real.
- El mockup de colores y la vista previa son referencias visuales; la vista previa conserva la presentación existente, no simula el envío de una respuesta.
- El rediseño **no corrige** ni certifica la lentitud de navegación o el flujo E2E completo de assessments; estos siguen en la certificación G1.

## Instalación

1. Verifica que partes de tu copia vigente. Realiza el respaldo G0 antes de extraer si no lo has hecho.
2. Detén los procesos de desarrollo.
3. **Extrae el ZIP incremental** directamente sobre `C:\Users\aruma\Desktop\PROOFLINE`, conservando las rutas internas y sobrescribiendo los ocho archivos incluidos.
4. Ejecuta desde la raíz:

```powershell
node --test tests/workspace-enterprise-r3.test.mjs
pnpm typecheck
pnpm build
```

5. Arranca mediante la tarea VS Code **Proofline: 2 · ARRANCAR TODO**. Comprueba ES y EN, escritorio (1440 px) y móvil (390 px), y todas las rutas anteriores.
6. Prueba las operaciones ya existentes: invitar, modificar un rol, gestionar alcance, crear/importar directorio, guardar logo/color, cambiar método de pago, abrir ticket, pedir cambio contractual, filtrar y paginar.

## Evidencias de esta entrega

- `node --experimental-strip-types --test tests/*.test.mjs`: **260/260** pruebas correctas (243 acumuladas + 17 específicas nuevas).
- `node scripts/static-audit.mjs`: **377** fuentes verificadas sin errores.
- Los **ocho TSX** editados fueron transpilados sintácticamente con TypeScript 5.8.3 sin errores de parseo.
- CSS verificado mediante parser estructural, sin errores de reglas.
- **Pendiente**: `pnpm typecheck`, compilación integrada Next en Windows, render real con datos y pruebas de interacción visual en navegador. Se intentó prueba headless Chromium en el entorno de auditoría pero no finalizó; no se declara superada.

## Alcance y reversión

En este paquete se incluyen rutas **relativas** para aplicar sobre la base. Para revertir, restaura los ocho archivos antiguos desde G0 o desde el ZIP de estado real, elimina `apps/web/app/workspace-enterprise-r3.css`, `tests/workspace-enterprise-r3.test.mjs` y retira su import en `apps/web/app/layout.tsx`.

**Criterio de cierre:** pasar tests y typecheck/build; verificar cada pantalla y su principal acción real en navegador, antes de declararlo aprobado.
