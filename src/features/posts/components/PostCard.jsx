// src/features/posts/components/PostCard.jsx

import Link from "next/link";

export default function PostCard({ post }) {
  const authorName =
    post.author?.username || post.author?.first_name || "Unknown user";

  return (
    <article className="post-card">
      <header className="post-card__header">
        <p>
          Posted by <strong>{authorName}</strong>
        </p>

        <h2 className="post-card__title">
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
        </h2>

        <p className="post-card__meta">
          {new Date(post.created_at).toLocaleDateString()}
        </p>
      </header>

      {post.body && <p className="post-card__body">{post.body}</p>}

      <footer className="post-card__footer">
        <span>{post.visibility}</span>
      </footer>
    </article>
  );
}
