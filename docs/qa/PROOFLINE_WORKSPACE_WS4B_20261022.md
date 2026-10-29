# PROOFLINE — Workspace WS-4B · Privacidad y Soporte

## Cambios reales
- `GET /v1/workspace/legal/assessments/table`: consulta en PostgreSQL por organización, permiso `legal.manage`, filtro de título/estado, paginación 25/50/100, total y cifra global de perfiles aprobados. Proyecta metadatos, **no identidades ni respuestas**.
- `GET /v1/workspace/legal` conserva contrato original por defecto; la interfaz usa `?assessments=none` para omitir únicamente esa lista cuando llama al endpoint nuevo.
- `GET /v1/workspace/support/table`: permite búsqueda de asunto/categoría y estado, limitado a la organización con `support.use`. Conserva contadores globales de tickets activos y no leídos, aunque la tabla esté filtrada.
- Las dos páginas muestran filtros ES/EN, estado vacío y links a ficha del assessment/ticket; paginación real preservando filtros.

## Pruebas manuales obligatorias (WS4B)
1. Navegar a Privacidad como Owner autorizado; buscar y filtrar; comprobar total y paginación 25/50/100, recargar y abrir ficha.
2. Comprobar que un usuario sin `legal.manage` no accede a datos legales de organización.
3. En Soporte buscar por asunto, filtrar cerrado/abierto, paginar, abrir ticket, enviar mensaje y verificarlo en Soporte (4205); no romper estado de leído.
4. Dos organizaciones diferentes deben ver exclusivamente sus propios assessments/tickets.
5. `pnpm typecheck`, `pnpm build`, `pnpm services:check`, `pnpm runtime:check`; la prueba PostgreSQL real NO se ha ejecutado en el entorno de generación.
6. Conservar componentes, scrollbar, tema, Control y comercial ya aprobados.

No se incorporan acciones decorativas. No se modifican los contratos de escritura ni las reglas de privacidad/retención.
