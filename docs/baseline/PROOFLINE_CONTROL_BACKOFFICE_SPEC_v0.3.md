# PROOFLINE CONTROL — Backoffice Product & Operations Spec v0.3

## 1. Purpose

Proofline Control is the internal control plane of ARMAR TECHNOLOGIES. Normal operational work must not require direct SQL, AWS console edits, Stripe manual hacks or hidden customer impersonation.

## 2. Principles

1. Total platform control, not indiscriminate Restricted-data access.
2. Every sensitive action has actor, reason and audit.
3. No shared superadmin accounts.
4. Least privilege and step-up auth.
5. JIT customer support access.
6. Financial operations are traceable and reversible through proper adjustments.
7. Legal/compliance state is visible and operable.
8. Control is a high-quality product, not an internal afterthought.

## 3. Navigation

```text
Overview
Organizations
Partners
Users
Plans & Entitlements
Subscriptions & Billing
Usage
Assessments
Marketplace
Reports
Communications
Support
Legal & Trust
Privacy / DSR
Security
Operations
Audit
Configuration
```

## 4. Dashboard

- active/trial/suspended organizations;
- partners;
- MRR/ARR where applicable;
- invoices paid/pending/past due;
- assessments active/completed;
- participant volume;
- report jobs;
- analysis jobs;
- email health;
- support SLA;
- DSR queue;
- legal agreements requiring action;
- subprocessor notices pending;
- security events;
- system health.

Never surface raw answers on dashboard.

## 5. Organizations

- create/provision;
- legal entity data;
- country/data region;
- owners;
- plan/entitlements;
- trial/grants;
- usage;
- billing status;
- DPA status;
- Terms/Order Form status;
- privacy configuration;
- assessment legal profile health;
- support history;
- security events;
- suspend/reactivate;
- offboarding workflow.

## 6. Users & memberships

- search;
- account state;
- roles/scopes;
- MFA/passkey state;
- invite/resend;
- revoke sessions;
- disable/enable;
- transfer ownership;
- security events;
- legal documents outstanding for that user.

## 7. Billing / entitlements

Proofline remains source of truth for effective entitlements.

Control:

- plan catalog;
- limits;
- feature flags by plan;
- grants;
- credits;
- enterprise overrides;
- subscriptions;
- invoice mirrors;
- refunds;
- credit notes/adjustments;
- payment links;
- reconciliation;
- usage meters;
- tax/VAT identifiers;
- contract references.

## 8. Assessments & analytics operations

- find assessment;
- health/status;
- metadata;
- aggregate progress;
- run history;
- reprocess/cancel jobs;
- report artifacts;
- legal profile status;
- privacy configuration;
- Restricted raw data only through authorized JIT flow.

## 9. Marketplace operations

- publishers;
- submissions;
- rights/license evidence;
- methodology evidence;
- validated claim review;
- versioning;
- pricing hooks;
- territories;
- approve/reject/pause/retire;
- usage/revenue-share metadata.

## 10. Support

- tickets;
- SLA;
- attachments;
- internal notes;
- communication history;
- escalation;
- SupportAccessSession.

### SupportAccessSession

- requester;
- org;
- purpose;
- requested scopes;
- sensitivity;
- client approval if required;
- step-up;
- TTL;
- revoke;
- audit.

## 11. Legal & Trust Center

### Legal Documents

- type;
- jurisdiction;
- locale;
- versions;
- content hash;
- review/approval;
- effective date;
- material change;
- reacceptance policy.

### Organization Agreements

- Terms acceptance;
- Order Forms;
- DPA;
- custom contractual documents;
- effective dates;
- renewals;
- authorized signatory/reference.

### Participant Notices

- templates;
- organization customizations;
- versions;
- locale;
- linked assessments;
- acknowledgement evidence.

### Assessment Legal Profiles

- completeness;
- legal basis declared;
- Article 9 condition if any;
- confidentiality mode;
- AI features;
- retention;
- DPO/contact;
- DPIA state;
- block launch if mandatory legal fields are missing.

### Subprocessors

- vendor;
- purpose;
- country/region;
- transfer mechanism;
- effective date;
- customer notice;
- objections.

### AI Feature Register

- feature;
- model/provider;
- role/purpose;
- data categories;
- human oversight;
- classification;
- jurisdictions;
- status.

## 12. Privacy / DSR

- request queue;
- request type;
- identity verification;
- controller coordination;
- deadlines;
- data discovery;
- export;
- deletion;
- restriction;
- completion proof;
- legal hold check.

## 13. Communications

- template versions;
- locales;
- transactional/assessment/commercial separation;
- delivery/bounce/complaint;
- suppression;
- report distribution;
- legal notice references;
- no full participant token display.

## 14. Security

- internal auth failures;
- suspicious user events;
- session revocation;
- step-up history;
- privileged-access review;
- organization suspension;
- token invalidation;
- incident link;
- WAF/provider event link.

## 15. Operations

- queue depth;
- DLQ;
- stuck jobs;
- analytics health;
- PDF health;
- webhook failures;
- email provider health;
- storage errors;
- scheduled jobs;
- deployed versions;
- feature flags;
- localization completeness;
- public site release status.

## 16. Configuration

- global feature flags;
- launch locales;
- legal policy requirements;
- retention defaults;
- cohort defaults;
- provider adapters;
- email domains;
- theme defaults;
- Marketplace settings.
