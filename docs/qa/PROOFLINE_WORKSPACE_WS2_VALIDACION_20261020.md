# PROOFLINE — Workspace WS-2/5 · Creación y preparación coherente

**Fecha:** 20/10/2026 · **Base:** WS-1/5 confirmada por el usuario.

## Cambios implementados — sin rediseñar pantallas ni modificar Control

1. **Manual:** una sola transacción persiste assessment DRAFT, nivel L1–L4, idioma ES/EN, traducción inicial y registro de auditoría. El endpoint conserva L2/ES como valores por defecto para clientes anteriores.
2. **Library:** crear desde framework incluye el nivel seleccionado en la petición inicial. La misma transacción persiste preguntas, traducciones, nivel y evento de auditoría. Sigue iniciando en PREPARATION.
3. **Importación:** el nivel se fija en la transacción que aplica la propuesta; se protege la aplicación única del origen por actualización condicional con rollback, documento vinculado y auditoría transaccional. Una propuesta ya aplicada devuelve su assessment anterior.
4. **Perfil legal:** los datos legales, desactivación de avisos anteriores, nueva versión, invalidación de readiness y auditoría se guardan en una sola transacción, para no dejar avisos desactivados sin reemplazo tras un error.
5. **Compatibilidad:** rutas y respuestas principales se conservan; validaciones de estado, RBAC y lanzamiento existentes no se modifican.

## Comandos de QA en Windows

Desde la raíz con los servicios normalmente activos:

```powershell
pnpm workspace:ws2:check
pnpm workspace:ws1:check
pnpm typecheck
pnpm build
pnpm services:check
pnpm runtime:check
```

## Piloto funcional (organización de prueba; evitar lanzamientos productivos)

- Manual: crear borrador ES y EN, niveles distintos, recargar ficha y verificar persistencia sin duplicados.
- Biblioteca: crear assessment L3/L4, comprobar preguntas, nivel, versión de framework y auditoría. Probar un framework sin blueprint válido: no debe quedar assessment nuevo.
- Importar TXT/CSV sintético: analizar, revisar, crear assessment L1; recargar y confirmar preguntas, origen documental y nivel. Reintentar la misma importación: no debe crear otro assessment.
- Preparación: editar preguntas, población y exclusiones, configurar privacidad, generar aviso legal, aprobar según rol, ejecutar Proofline Check, revisar previsualización y estado del checklist. Confirmar que la API bloquea READY/ACTIVE cuando faltan requisitos y que usuarios sin permiso no pueden aprobar.
- **Solo en tenant de test:** avanzar PREPARATION → REVIEW → READY → ACTIVE si se han satisfecho todos los gates; comprobar que se congelan versión y población, que hay invitaciones en outbox y que no se duplican los participantes.
- Verificar que un error al crear aviso legal revierte todos sus efectos; el test automatizado lo comprueba con base simulada, falta PostgreSQL.
- Mantener el piloto E2E completo y `pnpm pilot:check` para la certificación productiva; el timeout histórico del worker sigue sin evidencia de resolución.

## Evidencia / limitaciones

- Tests Node con transacciones simuladas: validan parámetros, recorridos internos, rollback modelado y contratos, **no son E2E de PostgreSQL**.
- Auditores de código estático superados. **Pendiente en esta sesión:** typecheck y build completos de monorepo (sin dependencias del proyecto instaladas), navegador Windows, worker, correo, PostgreSQL y E2E.
- No se modifican CSS, sidebar, scrollbars, Dashboard, Control, modelo Prisma ni infraestructura.

## Rollback

Este es un ZIP incremental. Antes de sobrescribir, guardar copia de los archivos que figuran en el manifiesto. Si hubiera regresión, restaurar **solo esos archivos** a la versión WS-1 validada y reiniciar servicios; las transacciones nuevas no requieren migración.
