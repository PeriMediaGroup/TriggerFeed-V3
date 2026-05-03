"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { formatRelativeTime } from "@/lib/formatDate";
import SmartText from "@/components/ui/SmartText";

export default function PostCard({ post, children }) {
  const [showComments, setShowComments] = useState(false);
  const postUrl = `/posts/${post.id}`;

  const authorName =
    post.author?.username ||
    post.author?.first_name ||
    post.author?.email ||
    "Unknown user";

  const authorId = post.user_id || post.author?.id;

  const commentCount = post.comment_count || 0;

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

          <p className="post-card__date">
            {formatRelativeTime(post.created_at)}
          </p>

          <h2 className="post-card__title">
            <Link href={`/posts/${post.id}`}>
              <SmartText text={post.title} />
            </Link>
          </h2>
        </header>

        {post.body && (
          <p className="post-card__body">
            <SmartText text={post.body} />
          </p>
        )}

        <button
          type="button"
          className="post-card__comments"
          onClick={() => setShowComments((current) => !current)}
        >
          {showComments ? "Hide comments" : ` (${commentCount})`}
          <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <Link href={postUrl} className="post-card__share-link">
          Share
        </Link>

        {showComments && (
          <div className="post-card__comments-panel">{children}</div>
        )}

        <footer className="post-card__footer">
          <span>{post.visibility}</span>
        </footer>
      </article>
    </>
  );
}
