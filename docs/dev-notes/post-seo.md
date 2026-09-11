# Public Post SEO

TriggerFeed keeps `posts.id` as the database identifier and uses `posts.slug` as the stable public URL identifier for titled, active public posts.

Canonical post URLs use `/posts/{slug}`. UUID URLs still resolve for backwards compatibility and redirect permanently to the slug URL when a slug exists. Existing slugs are not changed when a post title is edited.

Indexable posts must have a non-blank title, `visibility = 'public'`, `is_deleted = false`, and a slug. Untitled posts can still exist in the app but are excluded from sitemap and SEO metadata discovery.

`/sitemap.xml` includes public static pages plus eligible slug post URLs only. `/robots.txt` allows public content and references the sitemap while disallowing application, auth, admin, and API areas.
