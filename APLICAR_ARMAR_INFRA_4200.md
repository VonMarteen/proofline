# PROOFLINE — Aplicar normalización Armar 4200–4299

Este parche sólo normaliza infraestructura local, URLs, puertos, Docker y scripts de arranque. No modifica lógica de negocio, Prisma schema, autenticación funcional ni UI.

## Antes / después

| Servicio | Antes | Ahora |
|---|---:|---:|
| Site / Web principal | 3100 | 4200 |
| API cliente/public/respond | 4100 | 4201 |
| Workspace | 3101 | 4202 |
| Respond | 3102 | 4203 |
| Control UI | 3103 | 4204 |
| Support | 3104 | 4205 |
| Control API interno | 4200 | 4206 |
| Mailpit SMTP | 51025 | 4225 |
| PostgreSQL host | 55432 | 4232 |
| Mailpit Web | 58025 | 4280 |
| Analytics | 58100 | 4281 |
| MinIO API | 59000 | 4290 |
| MinIO Console | 59001 | 4291 |
| Redis | no existe | NOT_APPLICABLE; 4279 reservado |

## Aplicación

1. Extrae el ZIP sobre la raíz de PROOFLINE y permite reemplazar los archivos incluidos.
2. Si usas un `.env` local existente, ejecuta `pnpm infra:env:normalize`. El script crea una copia `*.pre-armar-4200.bak` antes de tocarlo.
3. Ejecuta `pnpm infra:legacy:stop`. Sólo detiene contenedores antiguos `proofline-dev-*`; no los elimina y no toca volúmenes.
4. Ejecuta `pnpm preflight`.
5. Ejecuta `pnpm infra:up`.
6. Arranca desde VS Code con `Proofline: 2 · ARRANCAR TODO` o `pnpm dev`.
7. Verifica con `Proofline: 3 · COMPROBAR SERVICIOS` o `pnpm services:check`.
8. Ejecuta `pnpm typecheck` cuando el entorno esté arriba.

## Datos

No hace falta `db:push` por este parche. El esquema Prisma no cambia.

Los volúmenes físicos existentes se conservan deliberadamente:

- `proofline-dev_proofline_postgres`
- `proofline-dev_proofline_minio`

El nuevo Docker Compose project es `armar-proofline`; sus contenedores usan nombres `proofline-*` y la red `proofline-net`.

`pnpm infra:reset` queda bloqueado para impedir borrado accidental de volúmenes. Usa `pnpm infra:down` para detener la infraestructura.
