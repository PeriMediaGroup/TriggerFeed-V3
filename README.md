# TriggerFeed V3.0

TriggerFeed V3.0 is a clean rebuild of TriggerFeed with a slower, steadier foundation-first approach.

The goal is simple: build the basement correctly before adding features, styling, ads, merch, videos, or any other shiny nonsense that makes apps fall over when someone sneezes near a login form.

## Current Status

### Stage One: Auth Foundation

## Local environment setup

Copy `.env.example` to `.env.local` and fill in the Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

Stage One is working.

Completed:

- New Supabase project created: **TriggerFeed V3.0**
- `profiles` table created
- `auth_events` table created
- `auth_events` indexes added
- `updated_at` trigger added for profiles
- `handle_new_user()` trigger added
- New Supabase Auth users automatically create matching `profiles` rows
- Row Level Security enabled
- Basic RLS policies added for `profiles`
- Basic RLS policies added for `auth_events`
- Signup page created
- Login page created
- Auth callback route created
- Onboarding page created
- Feed placeholder page created
- Login routes users based on profile state
- Onboarding saves username
- Authenticated profile reads confirmed
- Test Supabase page removed

## Core Rules

### Supabase

Supabase stores:

- Auth users
- Profiles
- Text data
- Relationships
- Permissions
- Logs/events
- Future posts, comments, votes, notifications, and messages

### Cloudinary

Cloudinary stores:

- Images
- Videos
- Profile avatars
- Profile banners
- Post media
- Future ad/merch graphics

Supabase should store Cloudinary URLs and metadata, not media files directly.

## Project Philosophy

TriggerFeed V3 is being built with this rhythm:

```txt
Plan
Build small
Test
Retest
Document
Commit
Repeat
```

No feature is considered done just because it worked once. That road leads directly back to chaos, and we have already paid tuition there.

## Tech Stack

- Next.js
- React
- Supabase
- Cloudinary later
- Plain CSS/SCSS planned
- No Tailwind for this project
- GitHub for version control
- Vercel likely for deployment

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not commit `.env.local`.

The service role key must never be used in frontend code.

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Useful current routes:

```txt
/signup
/login
/auth/callback
/onboarding
/feed
```

## Stage One Flow

### Signup

```txt
User signs up
Supabase creates auth.users row
Database trigger creates public.profiles row
User confirms email
Supabase redirects to /auth/callback
```

### Callback

```txt
/auth/callback checks session
Checks profile
If username is missing, redirects to /onboarding
If username exists, redirects to /feed
```

### Login

```txt
User logs in
Login success is logged
Profile is loaded
Banned/deleted users are blocked
Missing username redirects to /onboarding
Completed profile redirects to /feed
```

### Onboarding

```txt
User chooses username
Profile row updates
Onboarding completion is logged
User redirects to /feed
```

## Database Tables Created

### `profiles`

Main app-level user profile table.

Key relationship:

```txt
auth.users.id = public.profiles.id
```

### `auth_events`

Logs signup, login, callback, onboarding, and auth-related failures.

Used for visibility during testing and later admin/debug tooling.

## Security Notes

RLS is enabled.

Current policy direction:

- Authenticated users can read active profiles
- Users can update their own profile
- Users can insert their own profile as a repair fallback
- Anonymous users can insert limited auth events with no user ID
- Authenticated users can insert their own auth events or null-user pre-auth style events
- Users cannot read `auth_events` from the client

Protected profile fields like `role`, `is_banned`, and `is_deleted` should eventually be updated only through controlled admin/server-side flows.

## Next Stage

### Stage Two: Posts Foundation

Planned next:

- Create `posts` table
- Create `post_media` table
- Define Cloudinary upload rules
- Build basic create-post flow
- Build basic feed read
- Add RLS policies for posts
- Add error/event logging for post creation
- Test text-only posts before adding media

## GitHub

Repository:

```txt
https://github.com/PeriMediaGroup/triggerfeed-v3
```

## Notes

This project intentionally starts ugly.

Design comes after the foundation works.

A pretty broken app is still broken. It just wastes your time with better fonts.
