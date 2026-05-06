"use client";

import { useState } from "react";
import Link from "next/link";
import DeletePostButton from "./DeletePostButton";
import { MessageSquare } from "lucide-react";

import { formatRelativeTime } from "@/lib/formatDate";
import SmartText from "@/components/ui/SmartText";
import SharePostButton from "./SharePostButton";
import PostMediaGallery from "./PostMediaGallery";

export default function PostCard({
  post,
  currentUserId  = null,
  variant = "feed",
  children,
}) {
  const [showComments, setShowComments] = useState(false);
  const authorName =
    post.author?.username ||
    post.author?.first_name ||
    post.author?.email ||
    "Unknown user";
  const authorId = post.user_id || post.author?.id;
  const commentCount = post.comment_count || 0;
  const canManagePost = currentUserId === post.user_id;

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
          <SharePostButton postId={post.id} />

          <p className="post-card__date">
            {formatRelativeTime(post.created_at)}
          </p>

          <h2 className="post-card__title">
            <Link href={`/posts/${post.id}`}>
              <SmartText text={post.title} />
            </Link>
          </h2>
        </header>

        {post.media?.length > 0 && <PostMediaGallery media={post.media} />}

        {post.body && (
          <div className="post-card__body">
            <SmartText text={post.body} />
          </div>
        )}
        {canManagePost && (
          <div className="post-card__manage-actions">
            <Link href={`/posts/${post.id}/edit`} className="post-card__edit">
              Edit Post
            </Link>

            <DeletePostButton postId={post.id} />
          </div>
        )}

        <button
          type="button"
          className="post-card__comments"
          onClick={() => setShowComments((current) => !current)}
        >
          <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
          {showComments ? "Hide comments" : ` (${commentCount})`}
        </button>

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
