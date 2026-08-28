# START HERE — PROOFLINE v0.3

Esta carpeta sustituye completamente las baselines v0.1 y v0.2. **No iniciar código desde versiones anteriores.**

## Orden de lectura

1. `PROOFLINE_DDR_v0.3.md` — baseline maestra.
2. `PROOFLINE_LEGAL_COMPLIANCE_SPEC_v0.3.md` — modelo legal, consent/acknowledgement, DPA, participant notices, cookies, DSR y AI governance.
3. `PROOFLINE_PUBLIC_SITE_EXPERIENCE_SPEC_v0.3.md` — web comercial, modalidades, SEO, multiidioma y light/dark.
4. `PROOFLINE_CONTROL_BACKOFFICE_SPEC_v0.3.md` — backoffice ARMAR TECHNOLOGIES con Legal & Trust Center.
5. `PROOFLINE_TECHNICAL_ARCHITECTURE_v0.3.md` — superficies, dominios y boundaries técnicos.
6. `PROOFLINE_SECURITY_PRIVACY_BASELINE_v0.3.md` — seguridad, aislamiento y privacidad.
7. `PROOFLINE_BUILD_PLAN_v0.3.md` — orden real de construcción.
8. `PROOFLINE_v0.3_CHANGELOG.md` — diferencias respecto de v0.2.

## Regla de precedencia

v0.3 prevalece ante cualquier contradicción con v0.1/v0.2.

## Cambio arquitectónico principal

Proofline pasa a tener cuatro superficies web independientes:

- Public Site;
- Client / Partner App;
- Respond;
- Control.

Además, `Legal & Compliance` se convierte en un dominio de primera clase y no en textos dispersos en pantallas.

## Legal disclaimer

La baseline prepara el producto para operar de forma jurídicamente trazable, pero los textos, bases jurídicas y configuraciones finales deben ser revisados por asesoramiento legal/DPO antes de producción y adaptados a cada tratamiento/cliente.
