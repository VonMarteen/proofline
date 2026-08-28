# PROOFLINE — Technical Architecture v0.3

## 1. Architectural style

Proofline uses a **modular monolith** for business APIs, asynchronous workers for durable background execution, a separate Python analytics worker, and four independently deployed Next.js frontends.

This architecture optimizes for security, maintainability, auditability and a small engineering team without blocking later extraction of hot paths.

## 2. Deployable surfaces

| Deployable | Audience | Trust level | Primary responsibility |
|---|---|---|---|
| `site` | anonymous public | untrusted internet | marketing, sales, trust, legal |
| `web` | authenticated clients/partners | authenticated tenant | assessment/product operations |
| `respond` | invited participants | token-scoped untrusted | answering assessments |
| `control` | ARMAR internal | privileged | platform control plane |
| `api` | all surfaces | policy enforcement | business/domain API |
| `worker` | internal | service identity | email, import, PDF, webhooks, schedules |
| `analytics` | internal | restricted service | deterministic analytics and bounded AI |

## 3. Network / host model

Proposed hosts:

- `www.proofline.com` — marketing;
- `app.proofline.com` — client/partner;
- `respond.proofline.com` — participant;
- `control.proofline.com` — ARMAR internal;
- `api.proofline.com` — public/client/participant API boundary, route-scoped;
- internal service endpoints private only.

Control can later be protected additionally by identity-aware access/VPN if risk posture requires it.

## 4. Frontend isolation

### Site

- no Cognito SDK required for browsing;
- no access to tenant APIs;
- marketing analytics isolated;
- strict Content Security Policy;
- legal/cookie center;
- locale routing;
- theme.

### Web

- authenticated organization context;
- no direct provider calls;
- role/scope enforcement on API;
- theme + locale preference.

### Respond

- no tenant navigation;
- opaque token only;
- no third-party marketing trackers;
- stricter CSP than site;
- no access to organization admin endpoints;
- local progress only when safe + server-side durable save;
- legal notice version pinned at start.

### Control

- separate auth pool/session keys;
- invite-only;
- MFA/step-up;
- privileged endpoint namespace;
- Restricted data access only through SupportAccessSession.

## 5. Backend module map

```text
src/modules/
  auth/
  public-site/
  organizations/
  memberships/
  permissions/
  internal-access/
  legal/
  agreements/
  consent/
  data-requests/
  entitlements/
  billing/
  usage/
  assessments/
  frameworks/
  marketplace/
  questions/
  participants/
  collection/
  privacy/
  analysis/
  insights/
  reports/
  communications/
  support/
  audit/
  platform-config/
  operations/
```

## 6. Database boundaries

Logical schemas:

```text
core
identity
assessment
analysis
reporting
marketplace
billing
legal
support
platform
audit
```

### `legal`

Core entities:

- legal_document;
- legal_document_version;
- legal_interaction;
- consent_record;
- consent_withdrawal;
- organization_agreement;
- dpa;
- assessment_legal_profile;
- participant_notice_version;
- subprocessor;
- subprocessor_change;
- legal_hold;
- data_subject_request;
- ai_feature_register.

## 7. Multi-tenancy

- every tenant-owned row has `organization_id` where applicable;
- PostgreSQL RLS as defense in depth;
- API sets tenant context transactionally;
- global/internal access uses separate DB role/path;
- analytics gets scoped exports, not unrestricted DB access;
- tests must attempt cross-tenant access explicitly.

## 8. Identity and response segregation

`identity` contains direct identifiers encrypted at application level.

`assessment` contains pseudonymous participant ids and answers.

Encryption:

- envelope encryption via KMS;
- data encryption keys rotated by policy;
- HMAC blind indexes for lookup fields where needed;
- no plaintext email duplication in analytics/reporting.

## 9. Authentication

### Client users

Amazon Cognito user pool with UI owned by Proofline.

- passkeys/WebAuthn where supported;
- MFA;
- email verification;
- SAML/OIDC federation enterprise;
- session revocation;
- device/session metadata minimized.

### Internal users

Separate user pool and cookie namespace.

- invite-only;
- mandatory MFA;
- step-up for critical actions;
- short privileged sessions;
- impossible to reuse client token on Control endpoints.

### Participants

Opaque random tokens:

- 256-bit entropy class;
- hashed at rest;
- expiry;
- revocation;
- optional one-device/one-use policy configurable;
- no PII inside token.

## 10. Legal interaction architecture

Legal text is immutable once active.

Interaction flow:

```text
Resolve actor + jurisdiction + locale + scope
        ↓
Resolve active LegalDocumentVersion
        ↓
Render exact content/version
        ↓
Actor action
        ↓
Immutable LegalInteraction + content hash
        ↓
Gate access/feature only when policy requires it
```

No business code checks a hardcoded `accepted_terms = true`; it asks the Legal Policy service whether the required version/action is satisfied.

## 11. Internationalization

Central `packages/i18n`:

- typed keys;
- locale negotiation;
- BCP 47;
- fallback chain;
- date/number/plural formatting;
- message extraction CI checks;
- no untranslated production keys allowed for launch locales.

Separate translation domains:

- site;
- app;
- respond;
- control;
- email;
- reports;
- legal documents;
- marketplace content.

Assessment questions are database content with versioned translations, not UI dictionary strings.

## 12. Theme architecture

`packages/design-tokens` defines semantic CSS variables.

Never encode meaning only by color.

Themes:

- light;
- dark;
- system.

Charts use semantic data palettes designed separately for light/dark backgrounds and PDF output.

## 13. Design system

Components use accessible primitives but Proofline owns the visual system.

Packages:

- `design-tokens`;
- `ui`;
- `control-ui`;
- `charts`;
- `theme`.

Storybook is the visual contract and receives accessibility tests.

## 14. Async architecture

Transactional Outbox ensures DB mutation and event publication are not lost.

SQS queues by workload class:

- email;
- import;
- analytics;
- pdf;
- billing-webhook;
- privacy/deletion;
- marketplace;
- scheduled.

Each queue has:

- idempotency key;
- retry policy;
- DLQ;
- trace id;
- organization id where applicable;
- data-classification marker.

## 15. Analytics service

Python receives scoped analysis payloads through jobs/artifacts.

Libraries baseline:

- pandas;
- NumPy;
- SciPy;
- statsmodels;
- scikit-learn.

Rules:

- no Identity Vault credentials;
- deterministic metric calculation;
- reproducible run configuration;
- run version/provenance;
- qualitative AI only after minimization;
- output evidence links back to exact metric/run.

## 16. AI abstraction

`AIProvider` interface:

- generate structured output;
- classify;
- embed if approved;
- provider metadata;
- retention capability flags;
- region/data handling configuration.

The orchestrator enforces feature policy, not the UI.

## 17. Reporting

PDF worker:

- sandboxed Chromium;
- no arbitrary internet access;
- signed/internal asset URLs only;
- versioned template;
- SVG charts;
- deterministic locale formatting;
- report hash;
- S3 SSE-KMS;
- audience/privacy policy evaluated before render.

## 18. Public site delivery

Prefer static/ISR for public content.

Commercial CMS decision: start repository-driven/versioned content. Introduce a headless CMS only when non-engineering publishing frequency justifies it. Legal documents remain in Legal Engine, not generic CMS.

## 19. Infrastructure

AWS EU baseline:

- CloudFront;
- WAF;
- ALB;
- ECS Fargate;
- RDS PostgreSQL;
- S3;
- SQS;
- SES;
- KMS;
- Secrets Manager;
- CloudWatch/X-Ray.

Primary proposed region: `eu-central-1`; DR/backups in EU.

Separate AWS accounts/environments for production vs non-production.

## 20. Repository

```text
proofline/
├─ apps/
│  ├─ site/
│  ├─ web/
│  ├─ respond/
│  ├─ control/
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
├─ infra/tofu/
├─ docs/
│  ├─ adr/
│  ├─ product/
│  ├─ legal/
│  ├─ security/
│  └─ runbooks/
└─ .github/workflows/
```
