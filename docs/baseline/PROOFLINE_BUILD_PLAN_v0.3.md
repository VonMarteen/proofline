# PROOFLINE — Build Plan v0.3

## 1. Build philosophy

Build vertical foundations before feature volume. Every phase must preserve tenant isolation, legal traceability, auditability, i18n and theme support.

## 2. Phase 0 — Foundation

Deliverables:

- monorepo;
- Node/PNPM/Turbo;
- `apps/site`, `apps/web`, `apps/respond`, `apps/control`, `apps/api`, `apps/worker`;
- Python analytics service skeleton;
- PostgreSQL/Redis optional only if justified later/MinIO/Mailpit local stack;
- shared contracts;
- design tokens;
- light/dark/system theme;
- i18n package and ES/EN launch catalogs;
- Storybook;
- OpenTelemetry;
- audit event foundation;
- CI/security pipeline;
- Docker local;
- OpenTofu skeleton.

Exit criteria: all four surfaces run, share visual foundations but have separate deployments/security boundaries.

## 3. Phase 1 — Public Site + Trust shell

- complete commercial IA;
- Home/Product/Solutions/Marketplace preview/Trust/AI/Legal/Contact;
- SEO/i18n/theme;
- cookie preference center shell;
- lead form with privacy acknowledgement and separate marketing consent;
- sample report/demo placeholder with synthetic data.

## 4. Phase 2 — Identity, Organizations & Control foundation

- Cognito client pool;
- Cognito internal pool;
- organizations;
- memberships;
- roles/scopes;
- Control organization/user screens;
- RLS foundation;
- session revocation;
- step-up skeleton;
- SupportAccessSession skeleton.

## 5. Phase 3 — Legal & Compliance Engine

- legal documents/versions;
- acceptance/acknowledgement/consent records;
- withdrawal;
- Terms gates;
- DPA records;
- Assessment Legal Profile;
- Participant Notice versions;
- Subprocessor registry;
- Legal & Trust Center in Control;
- public Legal Center;
- cookie consent persistence;
- reacceptance workflows;
- DSR skeleton;
- AI Feature Register.

Exit criteria: Proofline can prove what legal text/version a user/participant saw and what action occurred.

## 6. Phase 4 — Billing, Plans, Entitlements & Usage

- plan catalog;
- entitlements;
- grants;
- Stripe adapter;
- webhooks;
- subscriptions;
- invoice mirror;
- usage ledger;
- credits/refunds hooks;
- Control billing UI.

## 7. Phase 5 — Assessment Engine + Library

- objective;
- questions/types;
- dimensions;
- scoring;
- logic;
- versioning;
- import;
- Library;
- Marketplace foundation;
- Assessment Check;
- framework provenance/license metadata.

## 8. Phase 6 — Population, Privacy & Respond

- import population;
- field-purpose manifest;
- Identity Vault;
- participant ids/tokens;
- Assessment Legal Profile launch gate;
- Respond app;
- participant notice;
- save/progress;
- multilingual assessment;
- invitation/reminders;
- cohort privacy;
- PII redaction pipeline.

## 9. Phase 7 — Analytics

- deterministic score engine;
- comparisons;
- longitudinal;
- gap analysis;
- response quality;
- qualitative preprocessing;
- bounded AI;
- provenance;
- Observation/Association/Hypothesis/Recommendation model.

## 10. Phase 8 — Results

- Objective Answer;
- Executive Brief;
- Insights;
- Evidence;
- privacy-safe filtering;
- charts/tables;
- theme-aware UI.

## 11. Phase 9 — Reporting & Distribution

- branded report templates;
- locale-specific report generation;
- PDF worker;
- audience variants;
- review/approve;
- recipients;
- email distribution;
- secure links;
- report legal notices.

## 12. Phase 10 — Support, Privacy & Operations

- support tickets;
- JIT flows;
- DSR full workflows;
- retention/deletion;
- legal holds;
- incident workflow;
- operational dashboard;
- DLQ tooling;
- email/webhook tooling;
- audit exports.

## 13. Phase 11 — Partner Marketplace

- publishers;
- framework submissions;
- license rights;
- validation evidence;
- private libraries;
- usage/licensing hooks;
- future revenue share.

## 14. Phase 12 — Production hardening

- AWS production;
- WAF;
- restore test;
- load test;
- pentest;
- tenant isolation attacks;
- differencing/privacy attacks;
- legal acceptance evidence test;
- cookie consent audit;
- accessibility audit;
- DPIA/legal review;
- AI Act feature review;
- billing reconciliation;
- incident tabletop;
- privileged access review.

## 15. Repository

```text
proofline/
├─ apps/
│  ├─ site/
│  ├─ web/
│  ├─ respond/
│  ├─ control/
│  ├─ api/
│  └─ worker/
├─ services/analytics/
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
├─ docs/{adr,product,legal,security,runbooks}/
├─ scripts/
└─ .github/workflows/
```

## 16. Definition of Done

A feature is not done if an applicable item is missing:

1. requirement documented;
2. tenant/internal authorization;
3. data classification;
4. purpose/minimization review;
5. legal interaction/gate if applicable;
6. audit event;
7. entitlement/billing effect if applicable;
8. i18n keys/content;
9. light/dark validation;
10. accessibility;
11. unit/integration tests;
12. critical E2E;
13. privacy regression;
14. no PII in logs;
15. observability;
16. ADR for architectural change.

## 17. Milestone 1 — Operable platform

Must demonstrate:

- public site in ES/EN and light/dark;
- organization/client user;
- internal Control user;
- Terms version shown/accepted;
- Privacy notice shown/acknowledged;
- organization visible in Control;
- entitlements modification audited;
- Stripe sandbox webhook idempotent;
- SupportAccessSession skeleton;
- audit end-to-end.

## 18. Milestone 2 — Legally traceable assessment

Must demonstrate:

1. create/import assessment;
2. objective;
3. Assessment Legal Profile;
4. participant notice version;
5. population;
6. invitation;
7. participant acknowledgement;
8. response;
9. deterministic analysis;
10. privacy-safe result;
11. report;
12. review/approve/distribute;
13. complete legal/audit evidence.
