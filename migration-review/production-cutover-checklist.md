# Production Cutover Checklist

## Preconditions

- [ ] Exposed legacy credential from `import-current-users-local.ps1` has been rotated or formally invalidated.
- [ ] Secret-bearing script comments have been removed in source before any production branch/release.
- [ ] Remote import scripts are corrected, renamed, or removed so script names match target behavior.
- [ ] All production connection strings are supplied through local operator environment or a secrets manager, never committed.
- [ ] `npx supabase db lint` has no unreviewed errors.
- [ ] Full import has been rehearsed in a disposable remote-like environment.
- [ ] Backup and restore process has been timed and approved.
- [ ] Owner has signed off on accepted missing/ignored legacy data classes.

## Suggested cutover sequence

1. Freeze writes on the legacy system or enter maintenance mode.
2. Take a final legacy database backup.
3. Take or confirm a target database backup/snapshot before import.
4. Apply V3 migrations to target.
5. Verify schema version and required functions/policies.
6. Import auth users and identities.
7. Import profiles.
8. Import posts and media.
9. Import comments.
10. Import friends.
11. Import votes.
12. Run verification SQL and sampled application smoke tests.
13. Confirm admin/moderation role behavior.
14. Point application environment to the approved target.
15. Monitor auth, feed, create-post, comments, votes, admin, and Edge Function logs.

## No-go conditions

- Any real credential remains committed or packaged.
- A remote import script still targets localhost.
- Row counts differ from accepted rehearsal thresholds.
- Auth/profile pairing is incomplete beyond accepted thresholds.
- Admin/CEO role boundaries fail.
- Rollback restore cannot be completed within the accepted outage window.

## Post-cutover

- [ ] Archive import logs securely, with secrets redacted.
- [ ] Decide whether staging tables should be dropped, moved, or retained for audit.
- [ ] Revoke temporary operator credentials.
- [ ] Confirm no service role key is present in frontend code or public logs.
- [ ] Monitor error rates and moderation/admin flows for at least one full usage cycle.
