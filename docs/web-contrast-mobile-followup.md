# Focused contrast and mobile follow-up

September 23, 2026. `/web` only. This addresses the deferred contrast and overflow findings from `web-stylesheet-review.md`; it does not replace that architecture review. No classes were renamed, no new styling system was introduced, and no application or database logic changed.

## 1. Contrast issues fixed

The original brand red works as a fill with light text, but not as small foreground text on the dark surfaces. Foreground accent declarations now use a separate light-red semantic token. The original `--color-accent: #b22222`, logo assets, backgrounds, borders, and red decorative fills remain unchanged.

| Pair / state | Before | After |
| --- | --- | --- |
| Accent foreground on `#2a3439` | `#b22222`, 1.91:1 | `#ff8585`, 5.43:1 |
| Accent foreground on black | `#b22222`, 3.14:1 | `#ff8585`, 8.95:1 |
| Accent foreground on soft surface `#344047` | `#b22222`, 1.60:1 | `#ff8585`, 4.54:1 |
| Merch button on brand red | `#0d0d0d`, 2.91:1 | White, 6.68:1 |
| Admin / notification action hover | Light text on `#a9a9a9`, 2.16:1 | Light text on `#303b41`, 10.54:1 |
| Mention-menu secondary text on hover | Muted text on the same muted gray, 1:1 | Existing muted text on `#303b41`, 4.89:1 |
| Profile error on standard surface | `#ef4444`, 3.38:1 | Accent foreground, 5.43:1 |
| Checked settings-switch thumb against red track | Surface gray, 1.91:1 | Existing primary text color, 6.12:1 |

Placeholder opacity was globally 0.25, with additional alpha reductions in several components. Placeholders now use opaque `#b8b8b8`; the representative input tests measure 5.03:1 or better, including the translucent search field where the ordinary muted token alone was insufficient. Normal muted body text stays `#a9a9a9`.

Applied the foreground correction to existing accent text/icons in auth, navigation/footer, public-page eyebrows, posts/editor, comments, profiles, friend/gun UI, ranks, votes, and notifications. The same defect accounted for most of the one-line changes across feature stylesheets. Signup's unstyled alternate/sign-in links and notification author links now use the existing inline-link approach with the accessible foreground. Button-style notification targets retain their separate treatment.

Strengthened existing low-alpha focus rings on auth, search, profile, friend/gun, composer, and merch controls. Actual disabled controls retain their disabled treatment. Sold-out merch sizes are informational spans: their text is no longer faded, their strike-through remains, and hovering them no longer gives them the available-size button treatment.

Contrast calculations use the [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Ratios are rounded only for this report. Browser scans of solid/composited backgrounds are evidence for the tested states, not certification of all image/gradient pixels or every possible user-generated screen.

## 2. Mobile overflow issues fixed

- Auth and welcome cards: include padding in their constrained width under the existing tablet breakpoint; allow inputs to shrink. Fixes login, signup, forgot-password, and welcome overflow without changing desktop card dimensions.
- Merch: include section padding in the section width; stretch the purchase link within its flex column instead of adding padding to `width: 100%`. The existing 70px mobile purchase-link height is preserved.
- Share dialog: constrain the padded panel to the viewport, contain the URL input, and wrap its actions. The dialog previously extended beyond the viewport even when document scroll width did not reveal it.
- Invite/referral UI: contain the padded URL input and stretch action links within their grid cells. This removes the card-edge collision while preserving action heights.
- Post/comment author text and notification content: permit long unbroken text to wrap and grid items to shrink.
- Rich content: constrain intrinsic image/video width and preserve aspect ratio so large media cannot widen the post grid.

No global overflow hiding was added. Admin tables retain their existing local horizontal scroll container; table contents remain reachable instead of being clipped.

## 3. Design-sensitive inconsistencies fixed

Only unambiguous cases were changed: missing signup/notification link colors, low-contrast hover surfaces, available versus unavailable merch interaction states, and padded controls escaping their own containers. Existing mixins, BEM names, and breakpoint aliases were reused. No radius, typography, spacing, or component-layout normalization was performed.

## 4. Files changed

- Shared: `src/styles/tokens.scss`, `_base.scss`.
- Shell: `src/components/layout/_layout.scss`, `navigation/_navigation.scss`, `ui/_ui.scss`.
- Primary fixes: `src/features/auth/styles/_auth.scss`, `merch/styles/_merch.scss`, `invites/styles/_invites.scss`, `posts/styles/_posts.scss`, `comments/styles/_comments.scss`, `notifications/styles/_notifications.scss`.
- Foreground / placeholder / focus corrections: post `_create.scss` and `_post-edit.scss`; profile `_profile.scss`, `_profile-header.scss`, `_profile-edit-form.scss`, `_profile-settings.scss`, `_profile-showcase.scss`; friend, gun, rank, vote, and search feature partials.
- Public text foregrounds: `src/styles/sections/about.scss`, `account.scss`, `contact.scss`, `founding-500.scss`, `legal.scss`, `public-pages.scss`.

Pre-existing marketing-attribution changes were preserved and are not part of this follow-up.

## 5. New / updated tokens

- New `--color-text-accent: #ff8585`: light-red foreground on dark surfaces; separate from the brand-red fill.
- New `--color-text-placeholder: #b8b8b8`: reusable readable placeholder text, including raised/translucent fields.
- Defined existing `--color-on-accent: var(--color-white)`: gives the red merch purchase button the same readable foreground convention as other red buttons.
- Updated `--color-surface-hover`: `var(--color-text-muted)` / `#a9a9a9` to `#303b41`, a dark surface that preserves primary and muted text contrast.

## 6. Reviewed and intentionally unchanged

- Existing palette differences for success/warning colors, contextual surfaces, and shadows were not globally normalized. Readable primary/muted labels and existing admin badges did not need new colors.
- Profile empty-metadata placeholder precedence remains unchanged; whether those placeholders should occupy space is still a product/layout decision.
- Existing rails/sidebar dimensions, avatar overlap, page-specific radii/spacing, hero gradients, and responsive breakpoints remain intact.
- Media credit/count overlays and lightbox toolbar backdrops were inspected; their dark backdrops already protect light foregrounds, so they were retained. Arbitrary uploaded artwork and every gradient pixel were not exhaustively contrast-tested.
- Intentional ellipsis and local table scrolling remain. Off-screen form honeypots remain off-screen.
- Authenticated pages were inspected through their stylesheet/component structure and representative browser fixtures. This was not a signed-in end-to-end check of private data or settings-save workflows. The `/founding-500` request redirects to the welcome gate without an authenticated session, so that request verified the gate rather than the roster.

## 7. Validation results

- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx vitest run`: 116 tests passed across 10 files.
- All 46 SCSS files compiled with zero Sass warnings.
- Before/after browser matrix: 10 requested routes at 320, 360, 375, 390, 414, 480, and 1440px (70 combinations). Routes: login, signup, merch, about, legal, contact, install, founding-500, forgot-password, welcome. No horizontal page overflow or JavaScript page errors in the final run.
- Desktop comparison: no geometry changes in the public/auth page matrix. Login desktop screenshots were inspected before/after; the intended text-color changes are visible and the layout is unchanged.
- Nine representative component fixtures at those seven widths (63 combinations): invite, share dialog, long post/media, comment, notification, profile/edit, settings, admin/table, and composer. No horizontal page overflow after the fixes. Dialog bounds and invite action containment were also checked visually.
- Mobile menu open/close and email-field focus checked at all six mobile widths. Existing settings checkbox keyboard operation passed. Admin/notification/mention hover contrast, eight input placeholder/focus cases, error/badge text, and merch available/sold-out hover/focus checks passed.
- Mobile login, merch, dialog, and invite screenshots were inspected. The latest width correction retains the original merch button height while containing it within the card.

Local screenshots, computed-style captures, state ratios, and comparison results are in `C:/Users/petes/AppData/Local/Temp/tf-css-followup/`. These are temporary verification artifacts, not production assets. No commit, push, or deployment was performed.
