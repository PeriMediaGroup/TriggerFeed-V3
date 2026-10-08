# Welcome product screenshots

The existing Inside TriggerFeed section now displays four supplied real screenshots. The hero, account sections, CTAs, attribution, About and SEO are unchanged.

## Assets and privacy

Added under `public/images/welcome/`:

- `triggerfeed-feed-desktop.png` — original 1371 × 922 capture.
- `triggerfeed-profile-desktop.png` — original 1379 × 922 capture with the email contact pill removed.
- `triggerfeed-feed-mobile.png` — original 395 × 841 capture.
- `triggerfeed-create-post-mobile.png` — original 384 × 835 capture.

The profile email rectangle, x=800–1079 and y=324–365, is replaced with opaque black pixels matching its background. A pixel comparison confirmed **zero changes outside that rectangle**. The other assets are original PNG copies. No lossy recompression, cropping, fabricated UI or generated replacement screenshot was published; an attempted generative edit was discarded because it altered unrelated details. Originals remain untouched outside the repository. No application/profile data was changed.

Visual inspection found no email addresses in the other three captures. Names, usernames, avatars, mutual-friend counts, profile location, birthday, biography, and the existing donation QR code remain visible in the supplied screenshots. These are privacy considerations for public marketing use; the requested email-only redaction does not anonymize the screenshots.

## Presentation and interactions

Wide desktop images sit beside phone-shaped mobile captures on large screens. Tablets group the mobile captures together; small screens stack the images. All images retain native aspect ratios, have descriptive alt text, and lazy-load below the fold. The four PNGs total approximately 912 KiB. Preview delivery intentionally retains original PNG sharpness.

Each screenshot is a semantic button with a View larger affordance and visible keyboard focus. A dynamically loaded lightbox reuses the already-installed `yet-another-react-lightbox` and Zoom plugin; no dependency was added. It provides a dark modal overlay, contained image, zoom/pinch, previous/next navigation, Close button, Escape and backdrop dismissal, background scroll locking/inertness, keyboard controls, accessible dialog labeling and focus restoration. Transitions are disabled, including for reduced-motion users.

## Files changed

- Four PNGs in `public/images/welcome/`.
- `src/features/welcome/WelcomeLanding.jsx`: replaces only the previous preview panels with the showcase.
- `src/features/welcome/WelcomeShowcase.jsx`: screenshot data, captions, preview buttons and lazy lightbox loading.
- `src/features/welcome/WelcomeLightbox.jsx`: existing-library lightbox configuration.
- `src/styles/sections/welcome.scss`: replaces unused preview rules with scoped responsive showcase styling.
- `src/features/welcome/WelcomeLanding.hydration.test.jsx`: four lazy-loaded, accessible SSR screenshot buttons with no initial modal.
- `src/features/welcome/welcomeAssets.test.js`: checks the actual public profile asset's dimensions and fully opaque email mask.
- `tests/e2e/welcome.spec.js`: four additional responsive lightbox checks.
- This report.

## Validation

Passed: ESLint, TypeScript, **132 unit tests across 14 files**, standalone Sass compilation without warnings, production build, and **13 Welcome browser checks**. The lightbox checks passed at 320, 390, 768 and 1440 pixels and covered all four image loads, original aspect-fit bounds, Enter activation, keyboard containment, reachable Close, Escape, close-button/backdrop dismissal, focus restoration, scroll locking and previous/next navigation. Existing signup, attribution/referral and responsive tests still pass. Desktop showcase and mobile lightbox screenshots were visually inspected.

The browser checks used the local development server; the production build passed separately. No deployment or commit was performed. This report supersedes the earlier landing report's statement that screenshot assets were still pending.
