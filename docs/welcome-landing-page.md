# Public Welcome landing page

## Implementation

`/welcome` is now a public introduction rather than a small sign-in gate. It renders on the server with existing TriggerFeed typography, colors, spacing, public header/footer, BEM styles and responsive conventions. It adds no dependencies or page-specific client component.

The page contains:

1. “Train. Carry. Stay Ready.” hero with Member signup and Sign In.
2. Anchor navigation and separate Member, Creator, and Organization sections, each linking to its existing signup flow.
3. A focused-community positioning section and About link.
4. A feature tour covering the feed, profiles, posts/media and polls.
5. A final free-membership conversion section, specialized signup links, existing-member sign-in, and 18+ information.

Authenticated visitors can view the page without a redirect or session change; their primary actions lead back to their feed. The authenticated shell retains its main landmark. Creator/Organization verification is described as separate from account creation. Age gates, account types, Founding 500, roles and verification rules are unchanged.

## Acquisition and referral journey

The existing root `AttributionTracker` remains the only visit recorder and first-touch store. `welcomeLinks.js` only constructs local destinations, forwarding `source`, `campaign`, `ref`, and existing UTM parameters. Values are encoded with URLSearchParams, repeated keys follow first-value semantics, and unrelated query keys are not copied. Internal-ad markers are retained so a later signup navigation cannot turn an excluded in-feed ad into an external marketing campaign.

Every landing signup/sign-in CTA carries these parameters. The existing mobile header's Signup/Login links use the same helper only on `/welcome`. Existing SignupForm referral persistence and marketing metadata submission remain unchanged. Browser tests confirm that Member, Creator, and Organization navigation retains the referral code and original `/welcome` first-touch landing path. The test visit RPC is intercepted to avoid polluting marketing data; no registrations or production conversions were created.

## About and SEO

About keeps its informational structure, responsible-ownership principles and useful existing content. It now explicitly describes Members, Creators and Organizations, and replaces named-platform/antagonistic comparisons with focused-community wording.

Welcome has the absolute title `TriggerFeed | The Firearms Community`, the requested description, canonical `/welcome`, and OpenGraph/Twitter metadata based on existing site constants. Campaign parameters are excluded from canonical/social URLs. About receives its own description and canonical. `/welcome` was already in the sitemap and allowed by the public-route rules; no sitemap, robots or public-post SEO changes were needed.

## Files changed

- `src/app/welcome/page.jsx`: server-rendered public route, auth-aware presentation, metadata.
- `src/features/welcome/WelcomeLanding.jsx`: landing content and image-ready feature-tour panels.
- `src/features/welcome/welcomeLinks.js`: shared query-parameter forwarding.
- `src/features/welcome/WelcomeLanding.hydration.test.jsx`: server rendering, authenticated rendering, CTA, metadata, referral and internal-ad regressions.
- `src/styles/sections/welcome.scss`: scoped responsive landing styles using existing tokens and helpers; no new color tokens.
- `src/styles/globals.scss`: stylesheet registration.
- `src/features/auth/styles/_auth.scss`: removes only obsolete Welcome-gate styling.
- `src/components/navigation/AppNavMenu.jsx`: preserves Welcome query parameters on existing Signup/Login links.
- `src/app/about/page.jsx`: focused content and metadata updates.
- `tests/e2e/welcome.spec.js`: responsive, keyboard, metadata, sign-in and signup-journey browser checks.
- `.gitignore`: ignores generated browser reports/screenshots.
- `docs/welcome-landing-page.md`: this report.

`docs/authenticated-feed-hydration.md` records the preceding feed-hydration task separately.

## Validation

- ESLint: passed.
- TypeScript (`tsc --noEmit`): passed.
- Vitest: **131 tests across 13 files passed**, including six new landing tests and the earlier authenticated-feed hydration regression.
- Production build: passed.
- Standalone Sass compilation: passed without warnings.
- Playwright against the local production build: **10 passed, one skipped**. Nine landing checks cover widths 320/390/768/1440, zero horizontal overflow, CTA tap sizes, all signup destinations, referral/first-touch retention, mobile header signup, keyboard focus, canonical/social metadata and sign-in. The existing home smoke test also passes. The separate authenticated-feed browser test is skipped because no test-account session was supplied, as previously discussed.
- Desktop and phone screenshots were visually inspected. Browser screenshots for the four widths are generated under the corresponding ignored `test-results/welcome-*` directories. The page was also checked with agent-browser.

Authenticated Welcome presentation is covered using a mocked authenticated server response; no live signed-in browser session was available. Existing registration/confirmation/conversion backend behavior was inspected and preserved, not exercised by creating a real account. No production deployment was performed.

## Assets and deliberately deferred work

The repository had merch/app-install/branding assets but no suitable product screenshots. The feature tour uses truthful descriptions and icons, without fake posts, invented screenshots or stock photos. Approved feed, profile and media screenshots can later populate the `previews` image entries in `WelcomeLanding.jsx` with source, descriptive alt text and native dimensions.

No new attribution system, schema changes, verification automation, authentication rewrite, global navigation redesign, new UI framework, paid features, or marketing-link destination migration was introduced. Existing QR links and `/join` behavior were not redirected as part of this task. A custom social-share image and live production conversion test remain optional follow-ups.
