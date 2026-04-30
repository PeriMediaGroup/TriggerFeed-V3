// src/features/posts/components/PostCard.jsx

import Link from "next/link";

export default function PostCard({ post }) {
  const authorName =
    post.author?.username ||
    post.author?.first_name ||
    post.author?.email ||
    "Unknown user";

  const authorId = post.user_id || post.author?.id;

  return (
    <>
      <br />
      <hr />
      <br />
      <article className="post-card">
        <header className="post-card__header">
          <p>
            Posted by{" "}
            {authorId ? (
              <Link href={`/profiles/${authorId}`}>
                <strong>{authorName}</strong>
              </Link>
            ) : (
              <strong>{authorName}</strong>
            )}
          </p>

          <p className="post-card__meta">
            {new Date(post.created_at).toLocaleDateString()}
          </p>

          <h2 className="post-card__title">
            <Link href={`/posts/${post.id}`}>{post.title}</Link>
          </h2>
        </header>

        {post.body && <p className="post-card__body">{post.body}</p>}

        {post.comment_count > 0 && (
          <Link href={`/posts/${post.id}`} className="post-card__comments">
            Comments ({post.comment_count})
          </Link>
        )}
        <footer className="post-card__footer">
          <span>{post.visibility}</span>
        </footer>
      </article>
    </>
  );
}
