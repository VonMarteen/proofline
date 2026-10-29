# PROOFLINE — Validación normalización Armar 4200–4299

## Validaciones ejecutadas sobre el parche

- `node scripts/armar-infra-audit.mjs`: PASS.
- Sintaxis Node de todos los scripts `.mjs` modificados: PASS.
- Parse JSON de `package.json`, `.vscode/tasks.json` y package.json de las cinco superficies: PASS.
- Parse TypeScript/TSX de los archivos modificados mediante TypeScript `transpileModule`: 44 archivos, 0 errores de sintaxis.
- Parse YAML de `docker-compose.dev.yml`: PASS; project `armar-proofline`.
- `scripts/static-audit.mjs` reconoce correctamente los nuevos puertos frontend: site 4200, workspace 4202, respond 4203, control 4204 y support 4205. En la baseline reconstruida continúa señalando dos guardrails antiguos de tenant-scope del Assessment Engine; no pertenecen a esta normalización y no se modificaron.

## Validación pendiente en el equipo Windows del proyecto

El entorno de generación no dispone de Docker Desktop del usuario, por lo que la comprobación real de ocupación de puertos, labels Docker y salud de contenedores se realiza mediante `pnpm preflight`, `pnpm infra:up` y `pnpm services:check` en el equipo local.

El preflight falla de forma explícita si detecta otro proyecto/proceso usando el bloque reservado o variables `.env` incoherentes.
