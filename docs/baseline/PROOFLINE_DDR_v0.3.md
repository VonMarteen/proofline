# PROOFLINE — Documento de Decisiones y Requisitos (DDR)

**Versión:** 0.3  
**Fecha:** 25 de agosto de 2026  
**Estado:** Baseline técnica y de producto revisada — incorpora Legal & Compliance Engine, web comercial, experiencia de participante separada, multiidioma y light/dark mode  
**Marca:** PROOFLINE — Signal & Structure — by ARMAR TECHNOLOGIES

## 1. Propósito

Este DDR sustituye completamente a las versiones 0.1 y 0.2. Es la baseline que debe utilizarse para cualquier arranque de código de Proofline.

Proofline es una plataforma B2B de **assessments e inteligencia organizacional**. Su límite funcional es diseñar, revisar, ejecutar, analizar, gobernar y distribuir assessments. No es un HRIS, CRM, ERP, BI generalista ni sistema de performance management.

El producto debe ser:

- robusto y duradero;
- seguro y hermético por arquitectura;
- transparente respecto de datos, permisos, IA y responsabilidades;
- visualmente premium;
- operativamente simple;
- multiidioma;
- adaptable a light/dark mode;
- comercializable tanto a empresas como a consultoras/partners;
- jurídicamente trazable para todas las partes involucradas.

## 2. Principios no negociables

1. **Objetivo antes que cuestionario.** Todo assessment declara qué pregunta empresarial quiere poder responder.
2. **IA acotada y verificable.** La IA revisa, sugiere, clasifica y redacta; no inventa metodología ni sustituye cálculos estadísticos deterministas.
3. **Answer → Insight → Evidence.** Primero respuesta ejecutiva; después profundización; finalmente evidencia, metodología y limitaciones.
4. **Privacy by architecture.** Identidad, respuestas, cohortes, permisos, retención, exportación y borrado son parte del dominio.
5. **Data minimization.** Cada dato personal solicitado debe tener finalidad documentada. Lo innecesario no se recopila.
6. **Legal clarity, not checkbox theatre.** Proofline distingue contrato, deber de información, acknowledgement y consentimiento. No se usa una casilla de “acepto” como sustituto de una base jurídica válida.
7. **No silent privileged access.** ARMAR TECHNOLOGIES puede operar la plataforma, pero no acceder silenciosamente a respuestas o identidad Restricted.
8. **Human approval before sensitive distribution.** Los informes no se distribuyen automáticamente sin revisión/aprobación autorizada.
9. **Marketplace / Library es core.** Proofline Originals, frameworks validados/licenciados, Partner Frameworks y Private Frameworks existen desde la arquitectura V1.
10. **Simplicidad visible, sofisticación interna.** El usuario no debe operar una herramienta compleja para obtener análisis sofisticado.
11. **EU-first.** Producción y backups principales dentro de la UE salvo excepción contractual documentada.
12. **Provider abstraction.** Auth, email, billing, IA, almacenamiento y traducción se aíslan mediante adapters.
13. **Monolito modular antes que microservicios.** La separación física sólo aparece cuando aporta seguridad, aislamiento o escalado real.
14. **Four-surface architecture.** Marketing, cliente/partner, participante y Control son superficies separadas aunque compartan core.
15. **Internationalization by design.** Ningún contenido crítico queda hardcodeado en un único idioma.
16. **Theme by design.** Light, dark y system son estados de primera clase en web comercial y aplicación; participante y Control también deben soportarlos cuando aporte valor.
17. **Accessible by default.** Objetivo WCAG 2.2 AA en superficies públicas y autenticadas.
18. **No dark patterns.** Consentimiento, cookies, suscripciones, cancelación y privacidad deben ser claros y simétricos.

## 3. Superficies del ecosistema Proofline

### 3.1 Proofline Public Site — `www.proofline.*`

Web comercial pública y principal punto de entrada de venta.

Debe ser:

- elegante, premium, rápida y altamente visual;
- comercial y comprensible sin lenguaje técnico excesivo;
- SEO-first;
- multiidioma;
- light/dark/system;
- preparada para campañas y conversiones;
- completa: producto, modalidades, seguridad, privacidad, Marketplace, recursos y contacto.

Páginas mínimas:

- Home;
- Product / How it works;
- Solutions — Companies;
- Solutions — Consultants / Partners;
- Assessment Library / Marketplace;
- Security & Privacy / Trust Center;
- AI Transparency;
- Pricing / Plans o Request demo según GTM;
- Sample report / Demo;
- Resources;
- About / ARMAR TECHNOLOGIES;
- Contact / Sales;
- Login;
- Legal Center.

La web debe explicar dos modalidades comerciales principales:

1. **Proofline Direct** — empresa utiliza Proofline para sus propios assessments.
2. **Proofline Professional / Partner** — consultora o partner gestiona múltiples clientes y metodologías.

También debe explicar tres formas de iniciar un assessment:

- Library / Marketplace;
- importar cuestionario existente;
- crear uno propio.

### 3.2 Proofline App — `app.proofline.*`

Aplicación autenticada para empresas y partners.

Roles base:

- Organization Owner/Admin;
- Assessment Manager;
- Analyst;
- Viewer / Stakeholder;
- Partner / Consultancy Admin.

La autorización real se resuelve mediante **organización + assessment + scope de datos + acción**.

### 3.3 Proofline Respond — `respond.proofline.*`

Experiencia de participante separada y minimizada.

Objetivos:

- no requerir cuenta salvo caso excepcional;
- token seguro y opaco;
- mínimo JavaScript y mínima superficie de ataque;
- CSP estricta;
- branding del cliente;
- multiidioma;
- accesibilidad;
- light/dark según configuración del assessment o preferencia del participante;
- notice legal específico del assessment antes de comenzar;
- cero exposición de navegación interna cliente/Control.

### 3.4 Proofline Control — `control.proofline.*`

Backoffice de ARMAR TECHNOLOGIES para operación total de plataforma:

- clientes, organizaciones y partners;
- usuarios y memberships;
- planes y entitlements;
- trials, grants y créditos;
- facturación, pagos, refunds y reconciliación;
- usage/metering;
- assessments, runs y artifacts;
- Marketplace;
- soporte;
- comunicaciones;
- privacidad, DSR y retención;
- Legal Center y versiones de documentos;
- seguridad, accesos privilegiados y auditoría;
- operaciones, jobs, webhooks, health y feature flags.

Control total de plataforma no equivale a acceso automático a datos Restricted.

## 4. Legal & Compliance Engine — decisión estructural

Proofline debe registrar jurídicamente **qué documento fue mostrado, a quién, en qué versión, idioma, jurisdicción y qué acción realizó la persona**.

No todo requiere consentimiento.

### 4.1 Tipos de interacción legal

| Tipo | Significado | Ejemplo |
|---|---|---|
| Contract acceptance | aceptación contractual | Terms of Service por representante autorizado |
| Acknowledgement | evidencia de haber sido informado | Privacy Notice / Participant Notice |
| Consent | base jurídica cuando realmente corresponde | marketing opcional o tratamiento específico basado en consentimiento |
| Explicit consent | consentimiento reforzado cuando la ley lo exige | categorías especiales si esa es la base válida |
| Organization agreement | acuerdo entre entidades | DPA / Order Form / Partner Terms |
| Approval | autorización operacional | cliente autoriza Support Access Session |

La Política de Privacidad **no se trata automáticamente como contrato**. Si se muestra una casilla, su semántica será “He sido informado” salvo que exista un tratamiento concreto cuya base jurídica sea el consentimiento.

### 4.2 Legal documents mínimos

- Terms of Service;
- Privacy Notice — account users;
- Cookie Policy;
- Data Processing Agreement (DPA);
- Subprocessor List;
- Acceptable Use Policy;
- Security / Trust statement;
- AI Transparency Notice;
- Marketplace / Publisher Terms;
- Partner Terms;
- Billing / renewal / cancellation terms;
- Participant Privacy Notice template;
- Assessment-specific Participant Notice;
- Data Retention statement;
- Data Rights / DSR information;
- Support privileged-access notice where applicable.

### 4.3 Assessment Legal Profile

Cada assessment tendrá un perfil jurídico configurable por el cliente y validado por permisos:

- responsable del tratamiento;
- encargado/subencargados relevantes;
- finalidad;
- base jurídica declarada por el responsable;
- condición adicional de artículo 9 si aplica;
- categorías de datos;
- participación obligatoria/voluntaria;
- modo de confidencialidad: identified / confidential-pseudonymous / anonymous;
- quién puede ver resultados individuales o agregados;
- periodo de conservación;
- destinatarios;
- transferencias internacionales si existieran;
- contacto de privacidad/DPO;
- derechos de la persona;
- uso de automatización/IA;
- si existe decisión automatizada significativa — por defecto **No**;
- versión del notice mostrado al participante.

Proofline no “elige” la base jurídica por el cliente. La plataforma guía, exige completar la información y puede advertir inconsistencias.

### 4.4 Legal evidence model

Entidades mínimas:

```text
LegalDocument
LegalDocumentVersion
LegalInteraction
ConsentRecord
ConsentWithdrawal
OrganizationAgreement
DataProcessingAgreement
AssessmentLegalProfile
ParticipantNoticeVersion
Subprocessor
SubprocessorChange
LegalHold
DataSubjectRequest
```

`LegalInteraction` debe conservar como mínimo:

- actor / participant pseudonymous id cuando corresponda;
- document version;
- locale;
- jurisdiction profile;
- action: accepted / acknowledged / consented / declined / withdrawn;
- timestamp;
- immutable content hash;
- organization / assessment scope;
- evidence request id/session id.

No almacenar IP por defecto sólo “por si acaso”; se documentará finalidad antes de utilizarla como evidencia.

## 5. Cookies y preferencias

### 5.1 Web pública

- cookies estrictamente necesarias: permitidas sin consentimiento cuando legalmente proceda;
- preferencias elegidas por el usuario — idioma/theme — se tratan como funcionales/técnicas cuando se usan sólo para esa finalidad;
- analytics/marketing no esenciales: requieren elección previa donde corresponda;
- `Accept all` y `Reject all` al mismo nivel y con visibilidad equivalente;
- sin casillas premarcadas;
- Consent/Preference Center siempre accesible.

### 5.2 App / Respond / Control

Priorizar cookies técnicas y first-party. Evitar trackers publicitarios. Analytics de producto debe diseñarse con minimización y evaluación jurídica separada.

## 6. Arquitectura seleccionada

### 6.1 Patrón general

**Monolito modular + workers asíncronos + worker analítico Python + cuatro frontends separados.**

```text
                            ┌─────────────────────┐
                            │   Public Site       │
                            │ www.proofline.*     │
                            └──────────┬──────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
        ┌───────▼───────┐      ┌───────▼───────┐      ┌──────▼───────┐
        │ Proofline App │      │ Respond       │      │ Control      │
        │ app.*         │      │ respond.*     │      │ control.*   │
        └───────┬───────┘      └───────┬───────┘      └──────┬───────┘
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       ▼
                              NestJS API boundary
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
            PostgreSQL                 S3            Outbox → SQS
                 │                                           │
       Identity / Assessment /                      ┌─────────┴─────────┐
       Analysis / Legal / Billing                   │                   │
                                                 TS Worker       Python Analytics
```

## 7. Stack principal

| Capa | Decisión |
|---|---|
| Runtime | Node.js 24 LTS, último patch soportado |
| Public Site | Next.js 16 + React + TypeScript |
| Client App | Next.js 16 + React + TypeScript |
| Respond | Next.js 16 + React + TypeScript, deployment separado y CSP estricta |
| Control | Next.js 16 + React + TypeScript, deployment separado |
| Backend | NestJS 11 + Fastify + REST/OpenAPI |
| Database | PostgreSQL 18.x |
| ORM | Prisma ORM 7 GA |
| Analytics | Python 3.14 + pandas + NumPy + SciPy + statsmodels + scikit-learn |
| Async | AWS SQS + DLQ + Transactional Outbox |
| Object storage | Amazon S3 + SSE-KMS; MinIO local |
| Email | Amazon SES; Mailpit local |
| Billing | Stripe adapter inicial; Proofline mantiene entitlements/usage propios |
| Client auth | Amazon Cognito User Pool, UI propia, MFA/passkeys, SAML/OIDC |
| Internal auth | Cognito User Pool separado, invite-only, MFA/step-up |
| Participant access | Tokens opacos de alta entropía, hash-at-rest |
| Cloud | AWS UE, ECS Fargate, RDS, S3, SQS, SES, KMS, Secrets Manager |
| IaC | OpenTofu |
| CI/CD | GitHub Actions + OIDC |
| Observability | OpenTelemetry + CloudWatch/X-Ray |
| UI foundations | Tailwind CSS 4 + Radix primitives/shadcn building blocks + Storybook |
| Data visualization | Apache ECharts + TanStack Table |
| Forms | React Hook Form + Zod |
| Rich content | Tiptap where justified |
| i18n | `next-intl`-style locale routing + typed message catalogs; BCP 47 locales |
| Theme | shared semantic design tokens + light/dark/system |
| Testing | Vitest + Playwright + Pytest + Testcontainers |
| Security | OWASP ASVS 5.0, CodeQL, Trivy, Gitleaks, SBOM, DAST |

## 8. Design System, idiomas y theme

### 8.1 Design System

Crear un sistema visual propio de Proofline, no una apariencia genérica de librería.

Paquetes compartidos:

- `design-tokens` — color, typography, spacing, elevation, motion;
- `ui` — componentes cliente/público/respond;
- `control-ui` — componentes operacionales específicos;
- `charts` — gramática visual de datos e informes.

### 8.2 Light / Dark / System

Estados:

- Light;
- Dark;
- System.

La preferencia:

- se guarda en perfil autenticado cuando existe;
- para visitante/participant puede persistirse localmente/cookie funcional;
- nunca debe afectar significado de colores analíticos;
- gráficos, PDFs y estados de accesibilidad deben tener paletas semánticas independientes y contrastes AA.

Los informes PDF pueden tener plantillas light/dark de marca, pero la versión por defecto profesional será configurable por organización y no dependerá automáticamente del theme de interfaz.

### 8.3 Internacionalización

Arquitectura compatible con cualquier locale BCP 47.

Baseline de lanzamiento técnico:

- Español (`es`);
- Inglés (`en`).

Preparación inmediata para:

- Portugués;
- Francés;
- Alemán;
- Italiano.

El producto no debe mezclar:

1. idioma de interfaz;
2. idioma del assessment;
3. idioma del informe;
4. idioma del email;
5. idioma legal.

Cada uno puede seleccionarse de forma independiente cuando corresponda.

## 9. Multi-tenancy y dominios de datos

PostgreSQL compartido con `organization_id` explícito y RLS como defensa en profundidad.

Schemas lógicos:

- `core` — organizations, memberships, permissions, entitlements;
- `identity` — identificadores directos cifrados;
- `assessment` — frameworks, questions, waves, participants, responses;
- `analysis` — runs, metrics, insights, evidence;
- `reporting` — reports, audiences, recipients, distributions;
- `marketplace` — listings, publishers, licenses, versions;
- `billing` — plans, subscriptions, invoice mirrors, usage, credits, grants;
- `legal` — legal documents, versions, interactions, DPA, notices, DSR;
- `support` — tickets, support sessions, internal notes;
- `platform` — feature flags, config, operational states;
- `audit` — customer and privileged audit events.

## 10. Identity Vault y acceso restringido

Los identificadores directos se separan lógicamente de respuestas y analytics.

```text
identity.participant_identity
  encrypted_email
  encrypted_name?          # sólo si es necesario
  blind_email_index
  participant_id

assessment.response
  participant_id
  question_id
  answer
```

El worker analítico no recibe acceso a `identity`.

Acceso Restricted requiere:

- permiso explícito;
- purpose;
- step-up auth cuando corresponda;
- TTL;
- auditoría;
- posible aprobación del cliente según contrato/configuración.

## 11. IA y AI governance

La IA nunca se llama directamente desde el navegador.

Flujo:

```text
Frontend → API → Authorization → Privacy/Minimization → AI Orchestrator → Provider
```

Principios:

- estadísticas y scoring son deterministas;
- el LLM recibe sólo lo necesario;
- PII se elimina/pseudonimiza antes de prompts cuando sea posible;
- outputs de IA tienen provenance;
- distinguir Observation / Association / Hypothesis / Recommendation;
- registrar modelo/provider/prompt-template version en análisis sensibles;
- no realizar decisiones laborales autónomas significativas;
- mantener AI Feature Register para evaluar AI Act y cambios regulatorios.

## 12. Reporting y distribución

Generación:

```text
Report data → versioned HTML/CSS → SVG charts → isolated Chromium → PDF → hash/version → encrypted S3
```

Flujo:

`Generate → Review → Approve → Distribute`

El reporte soporta:

- branding;
- idiomas;
- variantes por audiencia;
- reglas de privacidad;
- PDF y enlace seguro;
- audit trail;
- notice/disclaimer legal según assessment.

## 13. Proofline Control — ampliación legal

Control debe incluir un **Legal & Trust Center interno**:

- documentos legales y versiones;
- jurisdicciones/locales;
- aceptación/re-aceptación requerida;
- DPA por organización;
- Order Forms;
- participant notice templates;
- Assessment Legal Profiles;
- subprocessors y change notices;
- consent/acknowledgement evidence;
- DSR queue;
- legal holds;
- retention policies;
- AI feature register;
- incident/breach workflows;
- export de evidencia jurídica.

Ningún texto legal crítico se modifica directamente en producción sin versionado y publicación controlada.

## 14. Repositorio objetivo

```text
proofline/
├─ apps/
│  ├─ site/               # web comercial pública
│  ├─ web/                # cliente / partner
│  ├─ respond/            # participante
│  ├─ control/            # ARMAR TECHNOLOGIES
│  ├─ api/
│  └─ worker/
├─ services/
│  └─ analytics/
├─ packages/
│  ├─ design-tokens/
│  ├─ ui/
│  ├─ control-ui/
│  ├─ charts/
│  ├─ contracts/
│  ├─ i18n/
│  ├─ theme/
│  ├─ legal/
│  ├─ config/
│  ├─ observability/
│  └─ security/
├─ infra/
│  └─ tofu/
├─ docs/
│  ├─ adr/
│  ├─ product/
│  ├─ legal/
│  ├─ security/
│  └─ runbooks/
└─ .github/workflows/
```

## 15. Build order — baseline v0.3

1. Foundation + design tokens + i18n + theme + audit.
2. Public Site shell + Legal Center shell.
3. Identity / Organizations / Control foundation.
4. Legal & Compliance Engine + agreements + Assessment Legal Profile.
5. Billing / Entitlements / Usage.
6. Assessment Engine + Library / Marketplace foundation.
7. Population / Privacy / Respond / Collection.
8. Analytics / AI governance.
9. Results / Evidence.
10. Reporting / Distribution.
11. Support / DSR / privacy operations / legal operations.
12. Partner Marketplace.
13. Production hardening / pentest / DPIA / legal review.

## 16. Gates antes de producción

No lanzar producción sin:

- revisión jurídica española/UE de Terms, Privacy, DPA, Participant Notice y cookies;
- definición controller/processor por flujo;
- DPIA o determinación documentada de si procede, por tratamiento y casos de uso;
- Registro de Actividades de Tratamiento correspondiente;
- subprocessor inventory;
- data retention matrix;
- incident response y breach notification runbook;
- AI Act classification review por feature;
- accessibility audit;
- penetration test;
- restore test;
- privacy attack / differencing tests;
- billing reconciliation tests;
- cookie consent test;
- legal acceptance evidence test.

## 17. Estado de esta baseline

La v0.3 se considera **baseline suficiente para comenzar Fase 0**. Las decisiones jurídicas específicas deben ser validadas por asesoramiento legal/DPO antes de producción, pero el software debe nacer preparado para ejecutar y demostrar esas decisiones sin reconstrucción arquitectónica.
