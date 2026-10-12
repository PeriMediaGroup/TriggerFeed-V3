# Google Play child safety standards audit — 2026-10-12

Scope: Web Legal page only; Android/reporting/backend inspection was read-only. No database, RLS, migration, Android configuration, release or OTA changes. No reports or moderation actions were submitted during verification.

## Findings before the fix

| Published-standards requirement | Existing evidence |
| --- | --- |
| Explicit CSAE prohibition | Heading said `CSAE Policy`; body prohibited CSAM and child exploitation, but did not expand CSAE to Child Sexual Abuse and Exploitation or describe grooming, trafficking and sextortion. Relevant existing policy, not proof of noncompliance. |
| App/developer identification | `TriggerFeed` already present, matching the public Play listing. `Peri Media Group, LLC` was absent from the CSAE section. Google accepts the app OR developer name. |
| Public functioning webpage | Anonymous production GET returned 200, HTML, no login/Welcome redirect. No robots meta/X-Robots-Tag restriction; robots.txt allows `/`. No PDF/document dependency. |
| Anchor | Exactly one `id="csae"`; mobile and desktop could reach it. Concurrent fresh-load regression tests reproduced an intermittent failure to scroll, leaving the section below the viewport. |
| Child safety contact | Actual Play Console declaration is unavailable through installed tools. Published support emails do not establish the designated child safety contact or mailbox monitoring. |

The exact rejection cause cannot be established from the rejection category alone. Ambiguous CSAE wording and intermittent fragment navigation are plausible contributors. A wrong submitted URL/contact or reviewer-time accessibility issue remains possible but unverified. There is no evidence that Google requires a separate page: its guidance explicitly recommends anchor links.

Official requirements: https://support.google.com/googleplay/android-developer/answer/14747720?hl=en
Public app identification: https://play.google.com/store/apps/details?id=com.perimediagroup.triggerfeed — app `TriggerFeed`, developer display `Peri Media Group`, legal developer `Peri Media Group LLC` in the retrieved listing.

## Changes

- `src/app/legal/components/CSAE.jsx`: explicit requested heading and app/operator prohibition; CSAM, grooming/solicitation, exploitation/trafficking, sextortion; 18+ rule applying to all activity; existing abuse route linked directly, post-report instructions, content/account enforcement and legally required cooperation/reporting.
- Removed unverified promises of immediate bans, prompt review and automatic NCMEC/law-enforcement reporting. No scanning, staffing or response-time guarantees added.
- `src/app/legal/components/LegalSidebar.jsx`: reapplies a recognized initial fragment after hydration with instant scrolling to prevent interrupted smooth-scroll navigation. Existing anchors, sidebar links and public route retained.
- `src/app/legal/page.test.jsx`: terminology, identity, policy scope, reporting, unchanged sections and public-route regression checks.
- `tests/e2e/legal.spec.js`: anonymous desktop/mobile fragment positioning, HTML status, reporting navigation, no overflow/noindex and no-JavaScript readability.
- This audit document. Terms, Privacy, Cookies, abuse form and all reporting/backend implementations are unchanged.

## Reporting/enforcement inspection

- Web `ReportPostButton` and Android `ReportPostModal` offer `Illegal content` and free-text details. Their actions insert authenticated `post_reports`; Android verifies visible posts. Reporting is available inside Android feed cards and Post Detail.
- `/legal#abuse` accepts a required email, content/profile URL, optional offending username and description. `/api/report-abuse` validates inputs, then calls the existing report-abuse Edge Function, which inserts `abuse_reports`. No attachment upload is needed.
- `/admin/reports` loads post reports through `get_post_reports_for_moderation`; Admin/CEO also see abuse reports. Review/status history and existing protected moderation RPCs support content removal, warnings, mute/restrictions and bans.
- Web `/contact` lists `support@triggerfeed.com`; Android's menu links Contact and Legal. The retrieved Play listing lists `staff@triggerfeed.com` as support. Neither has been verified as the child safety contact, and neither was newly designated by this change.
- No dedicated account-report button or CSAE-specific escalation workflow was found. Account concerns can be described with a profile URL/username in the existing abuse form. Owner should confirm this covers operational intake needs.
- These are code-path findings, not live delivery/response-time certification. No production test reports, mail or account mutations were sent.

## Owner / Play Console checklist

1. Open App content → Child safety standards for `com.perimediagroup.triggerfeed`. Inspect the currently submitted URL and rejection details; preserve them for comparison.
2. Published standards URL: **https://www.triggerfeed.com/legal#csae**. Do not substitute a PDF or login-protected address.
3. Confirm the listing identifies `TriggerFeed` / `Peri Media Group` and the legal operator is Peri Media Group, LLC.
4. Designate a real individual/team contact able to explain CSAM prevention and policy compliance. Enter the appropriate working email and requested name/contact details; confirm the mailbox is monitored and can receive Google messages. No contact email is invented by this audit.
5. Review and truthfully certify in-app feedback, CSAM removal/action, compliance with applicable child safety laws, and the established reporting/escalation procedure. Confirm staffing/queue ownership and external reporting to NCMEC or relevant regional authority when required, including evidence handling. Code does not establish those operational procedures.
6. Review target audience and content-rating declarations against the 18+ service rule. The retrieved public listing shows `Teen`; a content rating is not the same as the app's permitted account age, but the declarations should be checked for accuracy.
7. After live verification, save/resubmit the corrected declaration or follow Google's resubmission instructions. No appeal or declaration is automatically submitted.

## Validation and release boundary

Validation passed: 154 Vitest tests across 19 files; ESLint; TypeScript; production build; 17 Playwright tests with 2 opt-in skips. `git diff --check` passed. Playwright's authenticated feed and destructive disposable Founding suites remain opt-in and are skipped without their fixtures; the public Legal tests require no account. Production post-deploy checks must confirm HTTP 200, exact new heading/operator text, fragment position on desktop/mobile, reporting link and HTML without JavaScript.

Production project verified: Vercel `trigger-feed-v3` (`prj_vZeenUZbxaBpbmEselIFUgqn0JXp`), team `team_FyY8KFrduPfeaV6ugjHucple`, custom domain `www.triggerfeed.com`, Git source `main`. Starting production commit: `f5a41c865aed8976f6035e4c3967e2295105b8b6`; its tree matched the working branch before this scoped change. Deployment uses that Git production branch with only the listed changes; no Supabase migration is applied.

No new Android build is required for this published Web policy fix. Google acceptance and operational compliance cannot be guaranteed by wording or automated tests.
