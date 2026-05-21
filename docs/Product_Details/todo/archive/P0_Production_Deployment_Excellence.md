# P0: Production Deployment Excellence

Status: in-progress  
Owner: Engineering + DevOps + Product  
Target window: immediate

## Goal

Make every production release predictable, observable, and reversible.

## Tasks

1. Release gates and checklists

- Define mandatory pre-release checks and owner sign-off.
- Require staging sign-off for source smoke tests.

2. Migration safety controls

- Add preflight checks for schema/data risks.
- Define rollback and forward-fix playbook.

3. Source verification matrix

- Verify receive, route, and reply behavior for active sources.
- Ensure lead creation path is validated in post-deploy checks.

4. Observability and alerting

- Monitor ingest failures and outbound delivery errors.
- Add threshold alerts for sustained 429/5xx patterns.
- Define escalation thresholds and on-call ownership.

5. Post-release stabilization

- Enforce 24-hour monitoring window for major releases.
- Capture incidents and feed improvements back into runbooks.

## Acceptance Criteria

- Every release has checklist sign-off and verification records.
- Time-to-detect for regressions decreases over time.
- Source integration incidents reduce measurably.
- Rollback path is documented and practiced.

## Dependencies

- None
