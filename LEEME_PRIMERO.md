# PROOFLINE C2 — ARRANQUE Y SEGURIDAD LOCAL

Esta carpeta está en **v0.2.6-C2.0**.

El flujo recomendado para actualizar una instalación C1.5.3 existente está en:

`APLICAR_PATCH_v0.2.6-C2.0.md`

Puntos clave:

- no uses `db:seed` para aplicar C2 sobre tu entorno actual;
- no uses `Infra · RESET TOTAL`;
- C2 requiere `db:generate` + `db:push` + `auth:bootstrap-local`;
- API cliente: `127.0.0.1:4201`;
- API privilegiada de Control: `127.0.0.1:4206`;
- Workspace y Control tienen credenciales, cookies y sesiones distintas;
- el arranque oficial de las superficies Next usa Webpack en Windows;
- OTP local se consulta en Mailpit: `http://localhost:4280`.

Después de aplicar y validar, usa:

1. `Proofline: 2 · ARRANCAR TODO`
2. `Proofline: 3 · COMPROBAR SERVICIOS`

La documentación funcional de C2 está en `CHANGELOG_v0.2.6-C2.0.md`.
