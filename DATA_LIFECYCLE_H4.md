# PROOFLINE · H4 — Retention & Data Lifecycle

## Purpose

H4 makes retention operational rather than declarative. Policies and legal holds are evaluated against persisted data and can be reviewed in a dry run before any destructive lifecycle action is confirmed.

## Safety model

1. **Dry run first** — `GET /v1/control/retention/preview` never mutates data.
2. **Explicit confirmation** — execution requires `confirm=EXECUTE_RETENTION` and a Control confirmation modal.
3. **Legal hold wins** — active holds are checked during preview and immediately again before every mutation.
4. **Audit evidence** — applied and failed actions plus each execution summary are stored in `AuditEvent`.
5. **No silent hard delete of document references** — document payloads/blobs are removed or anonymized while the `DocumentRecord` tombstone remains for referential/audit integrity.
6. **Locked policy protection** — locked retention policies cannot be changed from Control.
7. **Blocked records are enforced** — blocked/anonymized/destroyed document records are not served by branding, support attachment or invoice document flows.

## Supported lifecycle domains

| Record class | Persisted domain | DELETE | ANONYMIZE | BLOCK | RETAIN |
| --- | --- | --- | --- | --- | --- |
| `PARTICIPANT_IDENTITY` | `ParticipantIdentity` | removes identity | removes identity | unsupported | no action |
| `RAW_RESPONSE` | `Response` / `Answer` | removes response and revokes participant token state | removes identity + segment detail, keeps response | unsupported | no action |
| `PSEUDONYMIZED_DATASET` | `AnalysisRun.result` | removes analysis run | strips cohort detail and qualitative examples | unsupported | no action |
| `APPROVED_REPORT` | `Report.snapshot` | removes report and deliveries | strips cohort/evidence detail | unsupported | no action |
| Document record classes | `DocumentRecord` / `DocumentBlob` | destroys blob and leaves tombstone | destroys blob and leaves anonymized tombstone | marks `BLOCKED` | no action |

## Legal hold scope

A hold may apply to the full organization, an assessment or a record class/domain. Recognized broad scopes include `ALL`, `ORGANIZATION`, `ALL_DATA`, `ALL_RECORDS` and `ASSESSMENT` when assessment-scoped.

## Control UI

`Backoffice → Legal & Trust` now exposes:

- lifecycle dry-run summary;
- due/eligible/held/no-action counts;
- candidate table with policy and hold evidence;
- explicit execution action;
- policy editing for unlocked policies;
- creation/release of legal holds.

Workspace users with legal capability can see active policies and holds but cannot execute destructive lifecycle operations from the client plane.

## Verification

`control-runtime-check` validates that the retention dry-run returns a valid policy/candidate contract. Full destructive execution is intentionally excluded from the generic runtime check; it requires explicit operator confirmation and should be tested against disposable local fixtures.
