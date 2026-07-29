# Rollback Checklist

No dedicated rollback scripts were found. Rollback must be backup/restore based unless a separate rollback plan is created and rehearsed.

## Before cutover

- [ ] Capture final legacy backup.
- [ ] Capture target pre-import backup/snapshot.
- [ ] Record DNS, Vercel, Supabase, and environment-variable state before changes.
- [ ] Confirm who can approve rollback.
- [ ] Confirm expected restore duration.
- [ ] Confirm communication plan for maintenance/outage state.

## Rollback triggers

- Authentication failure for a broad user segment.
- Missing or corrupted imported data beyond accepted thresholds.
- Feed/create/comment/vote core flows failing after cutover.
- Role or RLS failure exposing protected data or privileged actions.
- Target database instability or unacceptable performance.

## Rollback sequence

1. Stop writes to the failed target, or put the app in maintenance mode.
2. Preserve logs and failed-run evidence with secrets redacted.
3. Restore target database from the approved pre-import snapshot, or repoint app to the previous stable database if that is the approved plan.
4. Restore prior application environment variables and deployment target.
5. Verify auth, feed, create, profile, and admin access on restored state.
6. Communicate rollback completion and next remediation owner.

## After rollback

- [ ] Document exact failure point.
- [ ] Compare expected vs actual row counts.
- [ ] Rotate any credential exposed during the failed run.
- [ ] Do not rerun production import until the failing condition is reproduced and fixed in rehearsal.
