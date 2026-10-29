# CHANGELOG — PROOFLINE Armar Infrastructure 4200–4299

## Alcance

Normalización exclusiva de infraestructura local, URLs, puertos, nombres Docker, preflight, tareas VS Code y documentación técnica.

## Cambios principales

- Todas las superficies locales pasan al bloque 4200–4299.
- Docker Compose project: `armar-proofline`.
- Contenedores: `proofline-postgres`, `proofline-mailpit`, `proofline-analytics`, `proofline-minio`.
- Red: `proofline-net`.
- PostgreSQL host: 4232; Mailpit SMTP/Web: 4225/4280; Analytics: 4281; MinIO: 4290/4291.
- Redis no se incorpora: `NOT_APPLICABLE`; 4279 queda reservado.
- Los volúmenes físicos existentes de PostgreSQL y MinIO se reutilizan para preservar datos.
- `pnpm preflight` valida puertos, Docker, variables locales y referencias legacy.
- `pnpm infra:legacy:stop` detiene infraestructura anterior sin borrar datos.
- `pnpm infra:reset` queda bloqueado por seguridad.
- `.vscode/tasks.json` usa los scripts normalizados y añade preflight/normalización `.env`.
- URLs internas de Workspace, Respond, Control, Support, API, email/OTP, analytics y callbacks se sincronizan.

No se modifica Prisma schema ni lógica funcional del producto.
