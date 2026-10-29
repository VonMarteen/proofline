# PROOFLINE Workspace — WS-1/5 | Permisos e integridad

**ARMAR Technologies — 20/10/2026**  
**Base:** `PROOFLINE_AUDIT_20261019-1651.zip` + P7, UX-A1, UI-01, UI-01R, UX-A2–A4, CQF1, CQF-F1–F4.  
**Directiva:** no modificar lo que ya funciona. Solo se alteran dos archivos de Workspace, un controlador de API, un comando de pruebas y las pruebas/documentación de WS-1.

## Alcance e implementación

| Gate | Antes | Después (código) | Evidencia pendiente |
|---|---|---|---|
| W-01 filtro de estado | Se enviaban etiquetas traducidas | `value` envía `DRAFT`, `ACTIVE`, etc. | Validar búsqueda/paginación en ES/EN con datos reales |
| W-02 destinatario ajeno | Desactivación por ID sin comprobar assessment | `updateMany` exige `id` + `assessmentId` + `active`; si no coincide da 404 y no audita | Retirada real y prueba de `rid` de otro assessment |
| W-03 roles | `team.manage` admitía escalada a ADMIN/BILLING_ADMIN | Solo OWNER concede o modifica roles privilegiados; cambios propios y OWNER protegidos; invitación no puede sobrescribir membresía existente; reemisión segura de activación pendiente | OWNER vs ADMIN en dos cuentas reales, intentos denegados, log de auditoría |
| W-04 atomicidad y trazabilidad | Se podían aplicar escrituras parciales | Importación y cambios de población dentro de transacción; comprobación de IDs del tenant; auditoría de importación, cambios de rol, retirada de membresía, alcance, población y destinatarios | Probar rollback en PostgreSQL; comprobar audit events y aislamiento |
| W-05 roles EN | Copia inglesa reutilizaba textos españoles | Resúmenes y capacidades EN específicos; controles de roles restringidos en UI | Alternancia ES/EN, modales y feedback de errores |

## Principios de seguridad de WS-1

- `ADMIN` **no** puede asignar ni modificar `ADMIN` o `BILLING_ADMIN`, aunque conserve `team.manage` para el equipo operativo.
- `OWNER` puede asignar esos roles a terceros, pero nadie puede autoasignarse roles ni modificar/eliminar un OWNER desde este endpoint.
- Invitar una cuenta que ya pertenece a la misma organización **no cambia silenciosamente su rol**. Para reemitir una activación pendiente, se exige conservar el rol existente y se genera evidencia `MEMBER_ACTIVATION_REISSUED`.
- No se actualiza el nombre global de una cuenta de otra organización al invitarla.
- Los IDs de unidades, personas y assessments deben pertenecer a la organización correspondiente. La validación se realiza en API, no solo en el navegador.
- Cambios de rol, retirada de membresía, concesión de alcance, audiencia y baja de destinatarios registran evidencia dentro de la transacción que realiza las mutaciones.
- `launchedAt` bloquea edición de población, aunque el estado informado se encuentre en una transición anterior.

## Controles automatizados realizados en entorno de revisión

- `node --test tests/workspace-ws1-security-integrity.test.mjs` → **16/16**.
- `node --experimental-strip-types --test tests/*.test.mjs` → **151/151** en Node 22.16.0 (la bandera se usó porque seis pruebas anteriores importan archivos `.ts` directamente).
- `node scripts/static-audit.mjs` → **OK, 375 archivos**.
- Los tres archivos TS/TSX cambiados superan la comprobación de sintaxis de TypeScript.
- **No ejecutados aquí:** `pnpm typecheck`, `pnpm build`, servicios, PostgreSQL, navegador, correo ni piloto E2E.

## Instalación (ZIP incremental)

1. Antes de aplicar el ZIP, conserva una copia de los archivos afectados si necesitas un rollback manual.
2. Extrae el ZIP sobre `C:\Users\aruma\Desktop\PROOFLINE` conservando rutas y sobrescribiendo **solo** los archivos incluidos.
3. **No ejecutar `db:seed`, `db:push`, reset ni migraciones por esta entrega.** No se modifica el esquema Prisma.
4. En terminal de VS Code, desde raíz:

```powershell
pnpm workspace:ws1:check
pnpm typecheck
pnpm build
```

5. Arranca con **Proofline: 2 · ARRANCAR TODO** y ejecuta:

```powershell
pnpm services:check
pnpm runtime:check
pnpm pilot:check
```

## Recorridos de aceptación manual

Usar **dos organizaciones sintéticas** y cuentas de prueba sin datos personales reales.

1. **ES/EN:** `/es/assessments` → seleccionar Borrador → comprobar que se filtra por `DRAFT`, sin recargar toda la aplicación; verificar `/en/assessments` y paginación.
2. **ADMIN:** invitar ANALYST/VIEWER permitido; intentar invitar ADMIN/BILLING_ADMIN denegado; intentar cambiar un BILLING_ADMIN a VIEWER denegado, sin cambios persistidos.
3. **OWNER:** asignar BILLING_ADMIN a otro miembro permitido; el cambio queda visible tras recargar y genera auditoría; comprobar que no puede modificar su propia membresía.
4. **Invitaciones:** invitar de nuevo un usuario activo ya miembro con otro rol → conflicto, ningún cambio; reemitir activación pendiente con el **mismo** rol → nuevo enlace y evidencia, sin cuentas duplicadas.
5. **Directorio:** importar lote con unidad de otra organización → error y 0 filas nuevas; lote válido → alta/actualización de todos los miembros; provocar error controlado en laboratorio y verificar rollback.
6. **Población:** intentar incluir unidad/persona de otra organización → error, población anterior intacta; guardar audiencia válida y comprobar conteo, persistencia y auditoría; assessment lanzado → bloqueado.
7. **Destinatarios:** intentar retirar `rid` perteneciente a otro assessment con permiso sobre el assessment actual → 404 y el destinatario ajeno continúa activo; retirar destinatario legítimo → persiste y audita.
8. **Regresión:** comprobar Control (4204), scrollbars, Dashboard, Marketplace, Legal & Trust y Seguridad sin cambios visuales ni de comportamiento.

## Criterio de cierre

WS-1 **implementado y con pruebas aisladas**, aún **no certificado E2E**. Solo dar por finalizado cuando tipo/build + pruebas con PostgreSQL + permisos positivos y negativos + persistencia + auditoría + regresiones de Control superen los gates.

## Límites y riesgos conocidos

- La creación/reeemisión de activaciones utiliza el servicio de correo ya existente; si falla la entrega después de crear una membresía, puede reintentarse desde `team/invite` con el mismo rol siempre que la cuenta siga pendiente. No declarar correo entregado sin evidencia del worker/outbox.
- Las importaciones de hasta 1000 filas se ejecutan en una transacción con timeout de 60 s. Debe medirse el rendimiento con lotes grandes en PostgreSQL antes de certificar ese límite en producción.
- La autorización y consistencia bajo concurrencia extrema requieren pruebas integradas adicionales. No se han modificado las reglas globales de RBAC ni la infraestructura.
