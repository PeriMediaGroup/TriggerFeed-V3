# Authenticated feed hard-reload hydration

## Reproduced cause and fix

`PostCard.jsx` nested the Founding Member `/founding-500` link inside the author's profile link. Server HTML therefore contained `<a href="/profiles/…"><a href="/founding-500">…</a>Author</a>`. The HTML parser closes/restructures nested anchors before React hydrates them. The initial React tree expects the inner anchor inside the profile anchor; the parsed DOM does not contain it there. This explains why a client navigation can appear fine while a hard reload fails, and why the trigger depends on the authors in the returned feed.

The real authenticated `Home → FeedPage → PostFeed → PostCard` hydration regression failed before the fix with “Hydration failed because the server rendered HTML didn't match the client.” After making the badge and author links siblings within a neutral name wrapper, it passes without recoverable errors, nesting warnings, or replacing the original organic DOM nodes. Both link destinations remain available.

The existing timestamp `suppressHydrationWarning` was also removed. `PostTimestamp` uses the serialized ISO date for SSR and the initial hydration snapshot, then displays relative time after hydration. A separate clock-skew test verifies this behavior.

## Render-path audit

- `/` authenticates on the server; `FeedPage` receives a validated query-string tab. FeedTabs renders that server-selected tab without storage or viewport state.
- Posts, viewer identity, ownership controls, votes, polls, and profile badges derive from supplied props. Modal/comment state begins closed. The prior ad-session effect and per-slot hydration gate remain intact.
- Ad placement, platform detection, visitor identity and delivery requests run after hydration. The server emits organic cards and empty ad slots. The random 6–9 gap algorithm and analytics handlers were not changed.
- Birthday/rank eligibility is resolved on the server. Greeting selection and persisted dismissal activate after hydration. Share browser capabilities affect a closed modal, not initial DOM.
- The legacy sidebar selector is server-rendered; its chosen markup is serialized, not independently selected during client hydration.
- Web feed data is a capped server snapshot, not cursor pagination. Actual PostFeed append behavior is covered in the regression; no pagination system was added.

## Validation and limits

Web lint, TypeScript, production build, and **125 tests across 12 files** passed. New tests retain real feed/card components, Next links, profile markup, media/poll/vote components and ads; they mock backend data/actions and the initially hidden comment content. Coverage includes authenticated hard reload with Founding Members, initial client rendering, tab selection, append stability, persisted dismissal, mobile ad platform detection, and clock changes. Earlier Strict Mode and delayed Suspense regressions still pass.

`tests/e2e/feed-hydration.spec.js` adds an authenticated browser check for navigation, hard reload, Back, scrolling and multiple ads. It requires `FEED_E2E_AUTH_STATE` pointing to a private local Playwright storage-state file and a seeded account with at least 18 posts and eligible ads. It is not reported as passed: no signed-in browser session was available. The user will manually verify production after deployment. The local reproduction confirms this specific defect, not inspection of the user's production session. No deployment or database changes were performed.
