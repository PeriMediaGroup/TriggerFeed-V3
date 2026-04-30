import Link from "next/link";

export default function ProfileLatestPost({ latestPost }) {
  if (!latestPost) {
    return (
      <section className="profile-latest-post">
        <div className="profile-latest-post__header">
          <h2 className="profile-latest-post__title">Latest Post</h2>
        </div>

        <p className="profile-latest-post__empty">
          No posts yet.
        </p>
      </section>
    );
  }

  const formattedDate = latestPost.created_at
    ? new Date(latestPost.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown date";

  const bodyPreview =
    latestPost.body?.length > 180
      ? `${latestPost.body.slice(0, 180)}...`
      : latestPost.body;

  return (
    <section className="profile-latest-post">
      <div className="profile-latest-post__header">
        <h2 className="profile-latest-post__title">Latest Post</h2>
        <time
          className="profile-latest-post__date"
          dateTime={latestPost.created_at}
        >
          {formattedDate}
        </time>
      </div>

      <article className="profile-latest-post__card">
        <Link
          href={`/posts/${latestPost.id}`}
          className="profile-latest-post__link"
        >
          <h3 className="profile-latest-post__post-title">
            {latestPost.title || "Untitled post"}
          </h3>
        </Link>

        {bodyPreview && (
          <p className="profile-latest-post__body">
            {bodyPreview}
          </p>
        )}

        <div className="profile-latest-post__footer">
          {latestPost.visibility && (
            <span className="profile-latest-post__visibility">
              {latestPost.visibility}
            </span>
          )}

          <Link
            href={`/posts/${latestPost.id}`}
            className="profile-latest-post__view"
          >
            View Post
          </Link>
        </div>
      </article>
    </section>
  );
}