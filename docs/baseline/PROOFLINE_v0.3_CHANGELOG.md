# PROOFLINE v0.3 — Changelog from v0.2

## Baseline status

v0.3 **supersedes v0.2**.

## Added

### Public Commercial Site

New `apps/site` deployment with:

- complete commercial IA;
- Direct and Professional modalities;
- Product/Solutions/Marketplace/Trust/AI/Legal/Resources;
- SEO;
- sample report/demo;
- lead generation;
- cookie preference center;
- multi-language;
- light/dark/system.

### Participant surface separation

New `apps/respond` deployment:

- isolated participant UX;
- stricter CSP;
- no marketing trackers;
- opaque token access;
- participant legal notice;
- i18n/theme support.

### Legal & Compliance Engine

New first-class domain:

- legal documents/versioning;
- contract acceptance;
- privacy acknowledgement;
- consent/withdrawal;
- organization agreements;
- DPA;
- Assessment Legal Profile;
- participant notice versioning;
- subprocessor registry;
- DSR;
- legal holds;
- AI Feature Register;
- legal evidence hashes;
- reacceptance/change management.

### Control changes

Proofline Control adds Legal & Trust Center and legal status across organizations/assessments.

### Internationalization

- typed i18n architecture;
- ES/EN baseline launch catalogs;
- BCP 47 support;
- independent interface/assessment/report/email/legal locales.

### Theme

- shared semantic design tokens;
- Light/Dark/System;
- public and app first-class support;
- participant/control compatible;
- chart/PDF palettes separated from UI theme.

### Repository

Added:

- `apps/site`;
- `apps/respond`;
- `packages/design-tokens`;
- `packages/charts`;
- `packages/i18n`;
- `packages/theme`;
- `packages/legal`;
- `docs/legal`.

## Changed

- Build order now places public site shell and Legal Engine before assessment execution.
- Security boundary expanded to four surfaces.
- Legal acceptance is no longer modeled as generic boolean checkboxes.
- Production gate now explicitly includes cookie, legal evidence, DPIA and AI Act reviews.
