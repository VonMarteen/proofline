# PROOFLINE Control — P7/7 · QA y gobierno

**Base:** `PROOFLINE_AUDIT_20261019-1651.zip` (snapshot recibido 19/10/2026).  
**Ámbito:** backoffice Control y rutas API ya existentes. No se alteran PostgreSQL, Prisma schema, infra, ni puertos.

## Modificaciones funcionales

1. **Configuración real:** idioma predeterminado de cada organización persistido en `Organization.defaultLocale`. Petición autorizada únicamente para `configuration.manage` (Platform Owner), actualización+evento de auditoría en una misma transacción Serializable. La ruta de generación de facturas existente lee esta propiedad. Búsqueda de organizaciones limitada a 80 caracteres y respuesta limitada a 50 registros; no cambia el locale de usuarios/assessments.
2. **Gobierno:** matriz de roles y capacidades obtenida del backend desde su fuente efectiva de verdad; protegida por `security.read`. La creación de usuarios internos se visualiza solo al Owner y sigue limitada por `security.manage` en API.
3. **Legal & Trust:** borradores versionados por documento+locale, hash SHA-256 del contenido, publicación segregada (Trust prepara; Owner publica), motivo obligatorio, despublicación anterior por documento+idioma en transacción Serializable, evento de auditoría transaccional. `publicDocs` sigue mostrando solo versiones activas efectivas. Interacciones legales requieren versión efectiva/activa y coincidencia de idioma y se registran con auditoría en la misma transacción.
4. **Experiencia:** etiquetas ES/EN de las nuevas operaciones, formulario responsive con confirmación en publicaciones y cambios, confirmación para liberar legal hold; mismas familias visuales y ThemeTokens del proyecto.
5. **Compatibilidad:** respuesta `/v1/control/configuration` conserva los campos preexistentes `plans`, `entitlements`, `brandingPolicy`, `defaults`, `locales` para `control-runtime-check.ts` y consumidores anteriores.

## Pruebas automatizadas locales en el entorno de entrega

- Tests P2–P7 ejecutados usando Node 22 con type stripping y TypeScript global: **50/50 PASAN** (P2:6, P3:7, P4:7, P5:9, P6:11, P7:10).
- Comprobación de sintaxis TS/TSX mediante TypeScript compiler API (parser).
- **No** equivale a una compilación del monorepo ni prueba E2E con DB/worker; aquí no hay `node_modules`, PostgreSQL ni los servicios Windows locales.

## Comandos de certificación en el equipo de desarrollo (Windows)

En VS Code ejecutar `Proofline: 2 · ARRANCAR TODO` y en una **segunda** terminal en la raíz del proyecto:

```powershell
pnpm control:p7:check
pnpm control:p6:check
pnpm control:p5:check
pnpm control:p4:check
pnpm control:p3:check
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm services:check
pnpm pilot:check
```

**Criterio:** P7 no puede declararse certificado si fallan typecheck, build, los tests o el piloto. El timeout previo de `pilot:check` sigue **sin diagnosticar ni resolver** por este parche.

## Piloto manual imprescindible

- Entrar con Owner a Configuración y cambiar ES → EN en una organización de prueba. Refrescar página y consultar audit trail; verificar que la siguiente factura generada utiliza EN. Volver a ES y verificar reversión y evento auditado.
- Entrar con Trust, crear una nueva versión legal **borrador** en un documento y comprobar que no aparece en `/v1/legal/public`. Asegurar que Trust no puede llamar a publicar (HTTP 403) aunque falsifique el formulario.
- Entrar con Owner, publicar borrador con razón válida (≥12 caracteres). Confirmar que documento+locale exponen solo la nueva versión pública, pero el otro idioma queda intacto. Revisar `contentHash` y el evento auditado.
- Como usuario del cliente: aceptar una versión publicada en el idioma correcto; verificar evidencia y auditoría, probar borrador/inactivo/locale incompatible (rechazados). Confirmar que los controles siguen sin conceder acceso a identidades cliente a la API interna.
- Comprobar navegación y layouts ES/EN, tema claro/oscuro, teclado/foco, móvil 375px/tablet 768px/desktop, contraste y estados de carga/error. Confirmar UX real en Pantallas de Configuración, Seguridad, Legal y Privacidad.
- Ejecutar un flujo E2E completo de alta → assessment → participante → scoring → L1-L4/PDF → distribución, comprobando ledger, trazabilidad y permisos.

## Gates de producción aún independientes

Redsys/PayPal sin adaptadores productivos; despliegue, dominios, proveedores definitivos, seguridad externa/penetration test, DPA/aviso jurídico por asesoría, monitorización y backup/restore probados, accesibilidad real, piloto E2E y conciliación de pagos requieren certificación separada. No confundir los tests de contratos/políticas con certificación de aplicación completa.
