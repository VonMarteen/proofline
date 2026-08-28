# PROOFLINE

**Signal & Structure — by ARMAR TECHNOLOGIES**

Estado local: **v0.2.6-C2.1.0**. Desarrollo orientado a Visual Studio Code en Windows.

## Superficies

- `apps/site` — web comercial y entrada Demo / Empezar.
- `apps/web` — Workspace de organización / partner.
- `apps/respond` — experiencia aislada del participante.
- `apps/control` — Proofline Control, backoffice interno privilegiado y supervisión global.
- `apps/support` — consola interna separada para agentes de soporte, limitada a tickets.
- `apps/api` — código Nest compartido por dos runtimes separados: API cliente y Control API.
- `apps/worker` — jobs asíncronos, email, analytics y escalado SLA.
- `services/analytics` — motor analítico Python.

## Zonas locales

- Site: `http://localhost:3100`
- Workspace: `http://localhost:3101`
- Respond: `http://localhost:3102`
- Control UI: `http://localhost:3103`
- Support Console: `http://localhost:3104`
- API cliente/public/respond: `http://127.0.0.1:4100`
- API interna de Control: `http://127.0.0.1:4200`
- PostgreSQL: `127.0.0.1:55432`
- Mailpit: `http://localhost:58025`
- Analytics: `http://localhost:58100`

La API cliente y la API de Control no montan los mismos controllers de privilegio. Workspace y Control mantienen cookies, sesiones e identidades distintas. En producción, Control puede usar además `CONTROL_DATABASE_URL` para una credencial de base de datos independiente y de privilegio mínimo.

## Desarrollo local

El flujo oficial vive en `.vscode/tasks.json`. Lee primero `LEEME_PRIMERO.md` y, para actualizar desde la baseline entregada por el usuario, `APLICAR_PATCH_v0.2.6-C2.0.md`.

Docker ejecuta PostgreSQL, Mailpit, Analytics y MinIO opcional. Las aplicaciones Node se ejecutan directamente en terminales integradas de VS Code.

Las cinco superficies Next arrancan con **Webpack** porque el entorno Windows del usuario bloquea el binding nativo SWC requerido por Turbopack.

## C2 / C2.1

C2 añade:

- login cliente contraseña + OTP + dispositivo confiable;
- identidad interna separada para Proofline Control;
- activación de usuarios cliente e internos;
- soporte con tickets, SLA, adjudicación, escalado, conversación y notas internas;
- solicitudes controladas de cambios contractuales;
- pipeline Demo / Start → Evaluation → Contract → Provisioning;
- alta automática de organización, suscripción y Owner desde Control;
- chequeo explícito de separación de trust zones;
- C2.1 separa la operación diaria de soporte en `apps/support`, deja Control como supervisión y añade histórico auditado;
- C2.1 incorpora fixtures aditivos de Nova Retail Iberia y Orbis Health Iberia para probar assessments activos, resultados y emails de distribución.

## Aplicar sobre un entorno existente

No uses seed ni reset para C2. Para C2.1 sigue exactamente `APLICAR_PATCH_v0.2.6-C2.1.0.md`.
