# PROOFLINE Control — CQF-F1: Recuperación operativa 1/3

**Base exacta:** `PROOFLINE_AUDIT_20261019-1651.zip` + P7 + UX-A1 + UI-01 + UI-01R + UX-A2 + UX-A3 + UX-A4 + CQF1 en ese orden. Aplicar este incremental **solo encima de esa base**.

## Fallos corregidos

1. **Sidebar desktop:** el bloque de marca y la identidad dejan de desplazarse; únicamente el `<nav>` es scrollable. No se sustituyen las reglas globales de scrollbars ni se altera la versión móvil.
2. **Marketplace:** cada framework enlaza a una ficha con metadatos efectivos, versiones publicadas, licencias, fechas, objetivo, enlaces a organizaciones y referencias verificadas de assessments. Los recuentos proceden de Prisma; la vista de referencias muestra como máximo 20 y lo informa. El Owner puede editar **solo descripción y categoría** de frameworks `PROOFLINE`, con validación de servidor, transacción y auditoría; versiones, scoring y relaciones no se tocan. Los frameworks de terceros siguen siendo de solo lectura.
3. **Legal & Trust:** cada versión enlaza a una pantalla propia para leer el contenido íntegro, verificar el hash frente al contenido en la API y consultar el historial de auditoría antes de publicar. No hay expansión dentro de la tabla. El flujo implementado real es: crear borrador → examinar → publicar como Owner con motivo y confirmación. **No se afirma que exista una aprobación independiente**: es funcionalidad pendiente si se requiere workflow de varios aprobadores.
4. **Seguridad:** la matriz RBAC enlaza a un detalle de rol con sus capacidades y usuarios asignados. Son **reglas fijas del servidor**, no un editor ficticio; los detalles se presentan fuera de la tabla para evitar saltos de altura. El Owner puede reasignar el rol de usuarios no Owner (sin autoedición ni promoción a Owner), con cambio persistente y auditoría. Los permisos efectivos se determinan en el servidor y cambian con el rol asignado.

## Resguardos

- No hay modificación de esquema Prisma ni nuevas migraciones.
- No se alteran los endpoints anteriores, contratos de listado, data tables, KPI, diseños de scrollbars, `Authentication`, facturación ni informes.
- Las mutaciones son procesadas y autorizadas en API; nunca se confía en el ocultamiento de botones como control de seguridad.
- Las operaciones sensibles requieren confirmación en la interfaz y auditan el actor y la modificación.
- Las reglas de roles `INTERNAL_*` no se editan dinámicamente. El acceso de emergencia y el reingreso Owner siguen gobernados por las prácticas actuales; revisar step-up y controles de despliegue antes de producción.

## Evidencia de tests en este entorno

- Comprobaciones nuevas de funciones + permisos con servicio TypeScript real transpiliado y DB simulada: **10/10 OK**.
- Pruebas ejecutables de todas las fases incluidas en el árbol reconstruido: **114/114 OK** con Node 22 y flag de carga TypeScript.
- Modificaciones TS y TSX: análisis sintáctico correcto.
- Limitación importante: **sin compilación integral**, **sin PostgreSQL real**, **sin navegador del usuario ni E2E**; las comprobaciones positivas de DB usan un doble controlado.
- Dos pruebas previas (CQF1 y UX-A4) han sido acotadas a sus bloques originales de CSS porque el cambio posterior de sidebar es deliberado y está cubierto por una prueba nueva; sus demás aserciones permanecen intactas.

## Instalación y certificación local en Windows

```powershell
pnpm control:cqf-f1:check
pnpm control:cqf1:check
pnpm control:uxa4:check
pnpm typecheck
pnpm build
pnpm services:check
```

Arrancar en VS Code con **Proofline: 2 · ARRANCAR TODO**. Comprobar manualmente:

1. Con sidebar con scroll, marca y cuenta permanecen fijas, scrollbar mantiene estilo estándar.
2. Marketplace → seleccionar framework → detalle → referencias sin desplegar filas. Owner edita su framework; se recarga el valor. Perfil de lectura y frameworks de terceros no editan. API rechaza POST sin permiso.
3. Legal → abrir versión en su pantalla → leer contenido completo, comprobar hash calculado → crear borrador → volver a abrirlo → publicar con motivo como Owner → comprobar estado y evento en Auditoría. Trust no publica.
4. Seguridad → abrir detalle de rol (referencia estática) → abrir usuario → cambiar un rol permitido como Owner → comprobar recarga, nuevo rol y evento auditado; no puede cambiar Owner ni promover a Owner.
5. Regresión: Dashboard, scrollbars, alertas, tablas y el resto de rutas previas permanecen correctos.

**Los tests automatizados correctos no certifican la experiencia completa.** No continuar la siguiente entrega hasta validar esta en la aplicación local.
