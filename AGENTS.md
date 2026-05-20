<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# TriggerFeed V3 Agent Instructions

## Project goals

TriggerFeed V3 should prioritize:
- Functionality before styling
- Clean Supabase schema and RLS
- Migration-first database changes
- Android/native portability
- Media handling that supports Cloudinary images/videos and external providers like GIPHY
- No hardcoded UI colors when theme variables exist
- No web-only assumptions in core business logic
- Avoid schema/name drift where possible
- Avoid partial saves when reasonable

## Review guidelines

Flag P1 issues for:
- RLS policies that allow spoofing, unauthorized inserts, or cross-user access
- Server actions that trust client-provided user IDs
- Media records that can be orphaned or saved with invalid provider/type combinations
- Migrations that conflict, duplicate constraints, or create naming drift
- Query changes that break feed/detail/profile pages
- Client components that introduce hydration issues
- Logic that saves posts but fails related media/poll data without a clear recovery path
- Missing validation on server actions
- Any issue that blocks future Android/native portability

Flag P2 issues for:
- Duplicated component logic between Create Post and Edit Post
- Naming inconsistencies like provider/source or sort_order/display_order
- Missing loading/error states
- Missing tests around create post, polls, GIPHY, and media uploads

Ignore:
- Minor styling polish unless it causes layout/functionality issues
- Preference-only naming comments unless they affect maintainability

<!-- END:nextjs-agent-rules -->
