# ARMAR INFRASTRUCTURE — PROOFLINE

Estado: normalización transversal Armar Technologies.

## Registro canónico

| Campo | Valor |
|---|---|
| Producto | PROOFLINE |
| Código interno | PROOFLINE |
| Bloque reservado | 4200–4299 |
| Web principal / Site | 4200 |
| API cliente/public/respond | 4201 |
| Workspace | 4202 |
| Respond / participante | 4203 |
| Admin / Control UI | 4204 |
| Support | 4205 |
| Control API interno | 4206 |
| PostgreSQL host | 4232 |
| PostgreSQL container | 5432 |
| Redis host | NOT_APPLICABLE (4279 reservado para PROOFLINE si se incorpora Redis) |
| Redis container | NOT_APPLICABLE |
| Mailpit SMTP host | 4225 |
| Mailpit SMTP container | 1025 |
| Mailpit Web host | 4280 |
| Mailpit Web container | 8025 |
| Analytics host | 4281 |
| Analytics container | 8000 |
| MinIO API host | 4290 |
| MinIO API container | 9000 |
| MinIO Console host | 4291 |
| MinIO Console container | 9001 |
| Docker project | armar-proofline |
| Docker network | proofline-net |
| Container prefix | proofline- |
| Volume prefix lógico | proofline- |

## Preservación de datos

La normalización cambia el Docker Compose project de `proofline-dev` a `armar-proofline`, pero **no migra ni elimina datos**. Para evitar separar la base existente, los volúmenes lógicos `proofline-postgres-data` y `proofline-minio-data` conservan como backing físico los volúmenes históricos:

- `proofline-dev_proofline_postgres`
- `proofline-dev_proofline_minio`

Esto es intencional. No ejecutar `docker compose down -v`, `docker volume prune` ni `docker system prune`.

Si los contenedores antiguos `proofline-dev-*` siguen activos, detenerlos con `pnpm infra:legacy:stop`. Ese comando sólo detiene contenedores; no elimina contenedores, volúmenes ni datos.

## Flujo local desde Visual Studio Code

1. `Proofline: Infra · PREFLIGHT ARMAR` o `pnpm preflight`.
2. Si se informa de infraestructura legacy activa: `Proofline: Infra · DETENER LEGACY (sin borrar datos)`.
3. `Proofline: Infra · ARRANCAR` o `pnpm infra:up`.
4. `Proofline: 2 · ARRANCAR TODO`.
5. `Proofline: 3 · COMPROBAR SERVICIOS`.

El preflight bloquea el arranque si un puerto reservado está ocupado por otro proceso/proyecto, si detecta variables locales incoherentes o si quedan referencias activas a puertos legacy.

## Notas

- Redis no existe actualmente en PROOFLINE; no se crea sólo para completar el registro.
- MinIO sigue siendo opcional mediante el profile Docker `files`, pero 4290/4291 quedan reservados para PROOFLINE.
- Los puertos internos de contenedores se mantienen sin cambios.
