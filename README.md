# PROOFLINE

**Signal & Structure — by ARMAR TECHNOLOGIES**

Estado local: **v0.2.6-C2.0**. Desarrollo orientado a Visual Studio Code en Windows.

## Superficies

- `apps/site` — web comercial y entrada Demo / Empezar.
- `apps/web` — Workspace de organización / partner.
- `apps/respond` — experiencia aislada del participante.
- `apps/control` — Proofline Control, backoffice interno privilegiado.
- `apps/api` — código Nest compartido por dos runtimes separados: API cliente y Control API.
- `apps/worker` — jobs asíncronos, email, analytics y escalado SLA.
- `services/analytics` — motor analítico Python.

## Zonas locales

- Site: `http://localhost:4200`
- Workspace: `http://localhost:4202`
- Respond: `http://localhost:4203`
- Control UI: `http://localhost:4204`
- Support UI: `http://localhost:4205`
- API cliente/public/respond: `http://127.0.0.1:4201`
- API interna de Control: `http://127.0.0.1:4206`
- PostgreSQL: `127.0.0.1:4232`
- Mailpit: `http://localhost:4280`
- Analytics: `http://localhost:4281`

La API cliente y la API de Control no montan los mismos controllers de privilegio. Workspace y Control mantienen cookies, sesiones e identidades distintas. En producción, Control puede usar además `CONTROL_DATABASE_URL` para una credencial de base de datos independiente y de privilegio mínimo.

## Desarrollo local

El flujo oficial vive en `.vscode/tasks.json`. Lee primero `LEEME_PRIMERO.md` y, para actualizar desde la baseline entregada por el usuario, `APLICAR_PATCH_v0.2.6-C2.0.md`.

Docker ejecuta PostgreSQL, Mailpit, Analytics y MinIO opcional. Las aplicaciones Node se ejecutan directamente en terminales integradas de VS Code.

Las cinco superficies Next arrancan con **Webpack** porque el entorno Windows del usuario bloquea el binding nativo SWC requerido por Turbopack.

## C2

C2 añade:

- login cliente contraseña + OTP + dispositivo confiable;
- identidad interna separada para Proofline Control;
- activación de usuarios cliente e internos;
- soporte con tickets, SLA, adjudicación, escalado, conversación y notas internas;
- solicitudes controladas de cambios contractuales;
- pipeline Demo / Start → Evaluation → Contract → Provisioning;
- alta automática de organización, suscripción y Owner desde Control;
- chequeo explícito de separación de trust zones.

## Aplicar sobre un entorno existente

No uses seed ni reset para C2. Sigue exactamente `APLICAR_PATCH_v0.2.6-C2.0.md`.

## Infraestructura local Armar

La asignación local canónica de puertos, Docker project, red, contenedores y volúmenes está documentada en `ARMAR_INFRASTRUCTURE.md`. Antes del arranque usa `pnpm preflight`.
