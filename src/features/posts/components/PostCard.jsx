"use client";

import { useState } from "react";
import Link from "next/link";
import DeletePostButton from "./DeletePostButton";
import { MessageSquare } from "lucide-react";

import { formatRelativeTime } from "@/lib/formatDate";
import MediaGallery from "@/features/media/components/MediaGallery";
import SmartText from "@/components/ui/SmartText";
import SharePostButton from "./SharePostButton";
import PostVoteButtons from "@/features/votes/components/PostVoteButtons";
import PollDisplay from "@/features/polls/components/PollDisplay";

export default function PostCard({
  post,
  currentUserId = null,
  variant = "feed",
  children,
  hideCommentsToggle = false,
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
  const postMedia =
    post.post_media || post.media || post.images || post.post_images || [];
  const mentionProfiles = post.mentionProfiles || [];
  const poll = post.polls?.[0] || null;

  return (
    <>
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

          <p className="post-card__date" suppressHydrationWarning>
            {formatRelativeTime(post.created_at)}
          </p>

          <h2 className="post-card__title">
            <SmartText text={post.title} mentionProfiles={mentionProfiles} />
          </h2>

          {variant === "feed" && (
            <Link href={`/posts/${post.id}`} className="post-card__detail-link">
              View post
            </Link>
          )}
        </header>

        {post.body && (
          <div className="post-card__body">
            <SmartText text={post.body} mentionProfiles={mentionProfiles} />
          </div>
        )}

        {postMedia.length > 0 && (
          <MediaGallery
            images={postMedia}
            fallbackAlt={post.title || "Post media"}
          />
        )}
        {poll && (
          <PollDisplay
            poll={poll}
            postId={post.id}
            currentUserId={currentUserId}
          />
        )}

        <PostVoteButtons
          postId={post.id}
          upvoteCount={post.upvote_count}
          downvoteCount={post.downvote_count}
          currentUserVote={post.current_user_vote}
        />
        {canManagePost && (
          <div className="post-card__manage-actions">
            <Link href={`/posts/${post.id}/edit`} className="post-card__edit">
              Edit Post
            </Link>

            <DeletePostButton postId={post.id} />
          </div>
        )}

        {!hideCommentsToggle && (
          <button
            type="button"
            className="post-card__comments"
            onClick={() => setShowComments((current) => !current)}
          >
            <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
            {showComments ? "Hide comments" : ` (${commentCount})`}
          </button>
        )}

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
