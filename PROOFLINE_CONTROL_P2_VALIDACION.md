# PROOFLINE — Control P2/7 · Enterprise tables and density

**Patch date:** 17 October 2026  
**Baseline:** PROOFLINE_AUDIT_20261017-0239.zip  
**Delivery:** incremental source only; extract into the existing PROOFLINE root. No database schema changes; no `.env` changes; no dependency upgrades.  

## Implemented

- Server-side `25 / 50 / 100` pagination, searches and whitelist sorting for Control Marketplace, Plan overrides/entitlements and Internal users.
- RBAC continues to be enforced at API endpoints (`marketplace.read`, `configuration.read`, `security.read`). Password hashes and session tokens are not returned by the internal-user table endpoint.
- A separate plan catalog endpoint prevents Plans page from fetching the entire entitlement table.
- Marketplace KPI totals are computed over the full dataset, not only the visible page.
- Stable ordering and safe page-bound clamping on new tables, including out-of-range URLs.
- Consistent enterprise table density, sticky headers inside scroll containers, responsive horizontal scroll and styled scrollbars, with existing colors/themes preserved.
- Explicit no-results states; previously invisible customer users without memberships now have a visible row in Users.
- Filter reset actions for the three newly paginated views.

## Local checks required after applying

Run from the root in VS Code:

```powershell
pnpm control:p2:check
pnpm typecheck
pnpm build
pnpm runtime:check
pnpm pilot:check
```

Then manually check at localhost:4204 in both Spanish/English, light/dark:

1. Marketplace: category, name/publisher search, order and next/previous/rows 25/50/100; KPI totals do not change when paging/filtering.
2. Plans: plan cards unaffected; 25/50/100 real entitlement records, organization/key filters, newest ordering and reset.
3. Internal users: roles, status, search, sorting, user without memberships in the separate Users view; no sensitive fields exposed.
4. Subscriptions and Organizations: real data, empty states, pagination, links and layout on narrow screens.
5. No API 500s, console errors or data exposure across roles.

**Execution evidence in this delivery:** 3 unit tests for pagination boundaries and 3 structural contract tests passed in this execution (Node 22 type stripping). The local pnpm command uses the already-installed `tsx` dependency for Node 20+ compatibility. Syntax/transpilation checks of modified TS/TSX sources passed. Full monorepo `pnpm typecheck/build/runtime/pilot` was not possible here without the repository's dependencies and running PostgreSQL, so functional runtime certification remains pending in the user's environment. The ZIP must not be considered installed or validated until those checks pass.
