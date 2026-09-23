# Web stylesheet architecture and cleanup review

Reviewed September 23, 2026. Scope: `/web` only. Safe refactors are implemented locally; no database, mobile, deployment, commit, or push operations were part of this work.

## Coverage and architecture

Reviewed all 44 original SCSS files, their import graph, and component class emitters. There are now 46 SCSS files after removing three unused files and adding five shared partials. Feature partials use one leading underscore. `globals.scss` composes the existing application styles in their original order; global defaults live in `_base.scss`, shared values in `tokens.scss`, and application-wide focus/reduced-motion defaults in `_accessibility.scss`.

The inventory covers layout, navigation, logo, UI; admin, both ad stylesheets, auth, comments, feed, friends, guns, invites, media and MediaGallery, mentions, merch, milestones, notifications, polls, post creation/editing/rendering, all five profile stylesheets, ranks, reports, search, votes; and about, account, contact, Founding 500, install, legal, and public-page sections. The two ad stylesheets retain distinct ownership and their existing import order.

## 1. BEM / naming cleanup

- Renamed 26 `__feature.scss` partials to `_feature.scss` and updated global imports.
- Changed navigation's create modifier to `app-nav__link--create`, including its JavaScript emitter.
- Normalized merch status modifiers to hyphenated names in both SCSS and the component, without changing stored status values.
- Replaced legal ID-based styling with the existing BEM anchor class; preserved the ID for navigation.
- Flattened footer descendant selectors into `app-footer__link` and `app-footer__label`, and simplified nested profile responsive selectors.
- No `!important` declarations were present or introduced. Third-party classes and established `.is-saving`/`.is-saved` states remain supported.

## 2. Duplicate or redundant CSS removed

Consolidated matching mention input/textarea declarations, adjacent comment blocks, legal section rules, install notes, and redundant admin text declarations. Removed overridden legal scroll spacing while preserving the effective 96px value. Retained overrides where their position in the cascade affects the current display, particularly profile metadata and editor controls.

## 3. Design token / variable improvements

Reused existing spacing/radius/color tokens for exact matching values. Added recurring white, spacing, radius, font-size, bold-weight, and transition values without changing resolved values. Moved application layout variables into the shared root token declaration. Existing unique dimensions, line heights, stacking values, and contextual color/shadow fallbacks remain local where normalization would change behavior or offer little benefit.

## 4. Link style consistency improvements

Shared decoration mixins now cover repeated inline and hover/focus underline patterns. Category-specific colors, typography, offsets, and selected states remain component-owned:

| Category | Treatment retained or improved |
| --- | --- |
| Body copy / rich content | Underlined inline links; existing offsets and color fallbacks preserved |
| Navigation / sidebar | Existing selected/active styles; visible keyboard focus |
| Footer / secondary | Existing muted colors and interaction underlines; component-scoped selectors |
| Cards / author links | Existing card and author treatments; author focus now mirrors hover |
| Settings / admin actions | Existing action/button treatments and disabled states; baseline focus fallback |
| Destructive / warning actions | Existing contextual colors and state rules retained |
| Button-style page links | Existing filled/outlined treatments; focus mirrors hover |

No global anchor recoloring or new visited-state policy was introduced. A blanket link token would override intentionally different existing category colors. Active/selected treatments remain unchanged. The shared focus fallback uses zero specificity so existing component focus rules still win.

## 5. Layout improvements

Moved footer rules out of navigation and post/profile overrides out of the global entry file into their owning stylesheets. Centralized shared header, footer, sidebar, rail, content, and safe-area dimensions. Existing flex/grid/gap layouts and sizing calculations were preserved. Removed fragile footer element selectors without changing rendered values.

## 6. Responsive improvements

Centralized repeated existing 36rem, 48rem, 68.75rem, 68.749rem, and 78.125rem boundaries in `_breakpoints.scss`. Kept exact units and the existing below-desktop boundary to avoid introducing overlap changes. Bespoke component breakpoints remain where their thresholds differ intentionally. No new responsive sizing system was introduced.

## 7. Accessibility and interaction states

Added a visible 2px keyboard-focus fallback for links, buttons, summaries, and button-role elements. Added focus-visible counterparts to several hover-only author, mention, legal-navigation, and hero-action styles. Shared visually-hidden labels preserve their original declarations. Reduced-motion preferences now disable smooth scrolling, shared transitions, loading shimmer, saving spinner, and poll result-bar transitions. Existing disabled, loading, selected, error, and success treatments remain in their established components.

## 8. Dead CSS removed

Removed the unimported, unused icon-button partial and two comment-only button/form placeholders. Removed obsolete `.comment__body`, `.post-card__action`, `.comment-item__action`, and `.back-link` rules after checking component emitters and dynamic class patterns. Retained similarly named live selectors, dynamic media modifiers, third-party `yarl__*` hooks, and state selectors. Removed obsolete commented declarations; explanatory comments remain.

## 9. Shared variables, mixins, and utilities

- `tokens.scss`: exact recurring spacing, radius, font-size, font-weight, white, transition duration/easing, and existing layout variables.
- `_breakpoints.scss`: named aliases for repeated existing media-query thresholds.
- `_mixins.scss`: `visually-hidden` and `rich-text-flow` shared by existing labels and rich content/editor styles.
- `components/_links.scss`: `underline-on-interaction` and `inline-decoration`, scoped through component includes rather than selector extension.
- `_base.scss` and `_accessibility.scss`: genuine application defaults separated from stylesheet composition.

## 10. Design-sensitive findings left unchanged

- Twenty-one color/shadow token names still rely on contextual fallbacks, including surface variants, links, danger/success/warning, button colors, and card shadows. Their fallbacks differ across components. Defining each globally requires a palette decision and could change existing screens.
- The current accent `#b22222` has approximately 1.91:1 contrast against `#2a3439` and 3.14:1 against black. Normal-size accent text in those combinations needs a separate accessibility/design correction. Muted and primary text against the surface calculate to approximately 5.42:1 and 11.68:1. This review is not a full contrast or accessibility certification.
- Login, signup, and merch already overflow horizontally at 390px in the browser baseline; the cleanup preserves that behavior. These layouts need a targeted responsive fix.
- The existing late profile metadata rule overrides an empty-placeholder display rule. Its effective behavior is preserved; changing placeholder visibility is a separate UI decision.
- Fixed ad rails/sidebar dimensions, avatar overlap, media positioning, honeypot offsets, editor descendant overrides, and dynamic media/poll styles have functional or visual purposes. They were not mechanically replaced or removed.
- Small controls, palette differences, bespoke breakpoints, and category-specific link behavior were not redesigned. No new global visited or pressed-state treatment was imposed.
- Raw compiled global CSS grew modestly with descriptive variable references and accessibility rules; this is a maintainability pass, not a demonstrated bundle-size optimization.

## Validation

- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, including all 43 static-generation tasks.
- `npx vitest run`: 103 tests passed across nine files.
- All 46 SCSS files compile with zero Sass warnings; the baseline also had zero warnings.
- Compiled declaration comparison, resolving token values and accounting for deliberate selector renames/removals, found no differences in retained normal-state declarations. New focus and reduced-motion rules were checked separately.
- Before/after browser comparison: seven routes (`about`, `login`, `signup`, `legal`, `contact`, `install`, `merch`) at 390, 768, 1100, and 1440px. All 97,280 computed-property comparisons matched; no JavaScript page errors occurred. Existing overflow was unchanged. About desktop and legal mobile screenshots were visually inspected.
- Synthetic component markup across seven viewport widths produced 13,300 matching property comparisons for representative feed, posts, comments, composer, profiles, settings, admin, ads, and related states. Six focus targets and reduced-motion behavior passed explicit checks.
- Authenticated workflows were not exercised with a live signed-in account. Synthetic component checks validate CSS behavior, not complete authenticated application flows. The development browser also reported an existing merch-image LCP loading hint; this is not a Sass/compiler failure.
- `git diff --check`: passed. Generated Next.js route typing changes returned to their original contents after the production build.

## Major files changed

`src/styles/globals.scss`, `tokens.scss`, the five new shared partials, `src/components/layout/_layout.scss`, `AppFooter.jsx`, navigation styles and `navigationLinks.js`, `src/app/legal/page.jsx`, `src/styles/sections/legal.scss`, mention/comment/post/profile/admin feature partials, and `MerchProductCard.jsx`. Exact-value token reuse also touches the remaining feature and public-section stylesheets listed in the coverage inventory.
