"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Edit3, MessageSquare } from "lucide-react";

import SmartText from "@/components/ui/SmartText";
import { formatRelativeTime } from "@/lib/formatDate";
import MediaGallery from "@/features/media/components/MediaGallery";
import PollDisplay from "@/features/polls/components/PollDisplay";
import ReportPostButton from "@/features/reports/components/ReportPostButton";
import PostVoteButtons from "@/features/votes/components/PostVoteButtons";

import DeletePostButton from "./DeletePostButton";
import SharePostButton from "./SharePostButton";

const DEFAULT_AVATAR_URL =
  "https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png";

export default function PostCard({
  post,
  currentUserId = null,
  variant = "feed",
  children,
  hideCommentsToggle = false,
}) {
  const [showComments, setShowComments] = useState(false);

  const avatarUrl =
    post.author?.avatar_cloudinary_url || post.avatarUrl || DEFAULT_AVATAR_URL;

  const displayName =
    post.author?.display_name ||
    [post.author?.first_name, post.author?.last_name]
      .filter(Boolean)
      .join(" ") ||
    post.author?.username ||
    "Unknown user";

  const authorName = post.author?.username
    ? `@${post.author.username}`
    : "Unknown user";

  const authorId = post.user_id || post.author?.id;
  const commentCount = post.comment_count || 0;
  const canManagePost = currentUserId === post.user_id;
  const postMedia =
    post.media || post.post_media || post.images || post.post_images || [];
  const mentionProfiles = post.mentionProfiles || [];
  const poll = post.polls?.[0] || null;

  const commentsLabel = showComments
    ? "Hide comments"
    : `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`;

  return (
    <article className="post-card">
      <header className="post-card__header">
        <Link
          href={authorId ? `/profiles/${authorId}` : "#"}
          className="post-card__avatar-link"
          aria-label={`View ${displayName}'s profile`}
          tabIndex={authorId ? undefined : -1}
        >
          <Image
            src={avatarUrl}
            alt={`${displayName} avatar`}
            width={50}
            height={50}
            className="post-card__header-avatar-image"
          />
        </Link>

        <div className="post-card__author">
          {authorId ? (
            <>
              <Link
                href={`/profiles/${authorId}`}
                className="post-card__author-display-name"
              >
                {displayName}
              </Link>

              <Link
                href={`/profiles/${authorId}`}
                className="post-card__author-username"
              >
                {authorName}
              </Link>
            </>
          ) : (
            <>
              <strong className="post-card__author-display-name">
                {displayName}
              </strong>
              <span className="post-card__author-username">{authorName}</span>
            </>
          )}

          <p className="post-card__date" suppressHydrationWarning>
            {formatRelativeTime(post.created_at)}
          </p>

          {post.is_sticky ? (
            <span className="post-card__official-badge">Official</span>
          ) : null}
        </div>

        <div className="post-card__header-tools" aria-label="Post actions">
          <SharePostButton postId={post.id} variant="icon" />

          <ReportPostButton
            postId={post.id}
            viewerHasReported={post.viewer_has_reported}
            variant="icon"
          />
        </div>
      </header>

      <div className="post-card__content">
        <h2 className="post-card__title">
          <SmartText text={post.title} mentionProfiles={mentionProfiles} />
        </h2>

        {post.body && (
          <div className="post-card__body">
            <SmartText text={post.body} mentionProfiles={mentionProfiles} />
          </div>
        )}
      </div>

      {postMedia.length > 0 && (
        <div className="post-card__media">
          <MediaGallery
            images={postMedia}
            fallbackAlt={post.title || "Post media"}
          />
        </div>
      )}

      {poll && (
        <div className="post-card__poll">
          <PollDisplay
            poll={poll}
            postId={post.id}
            currentUserId={currentUserId}
          />
        </div>
      )}

      <div className="post-card__actions">
        <div className="post-card__engagement-actions">
          <PostVoteButtons
            postId={post.id}
            upvoteCount={post.upvote_count}
            downvoteCount={post.downvote_count}
            userVote={post.current_user_vote}
          />

          {!hideCommentsToggle && (
            <button
              type="button"
              className="post-card__comments"
              onClick={() => setShowComments((current) => !current)}
              aria-expanded={showComments}
            >
              <MessageSquare size={16} strokeWidth={2} aria-hidden="true" />
              <span>{commentsLabel}</span>
            </button>
          )}
        </div>

        {canManagePost && (
          <div className="post-card__manage-actions" aria-label="Manage post">
            <Link
              href={`/posts/${post.id}/edit`}
              className="post-card__icon-action"
              aria-label="Edit post"
              title="Edit post"
            >
              <Edit3 size={16} strokeWidth={2} aria-hidden="true" />
            </Link>

            <DeletePostButton postId={post.id} variant="icon" />
          </div>
        )}
      </div>

      {showComments && (
        <div className="post-card__comments-panel">{children}</div>
      )}

      {variant === "feed" && (
        <footer className="post-card__footer">
          <Link href={`/posts/${post.id}`} className="post-card__detail-link">
            View post
          </Link>
        </footer>
      )}
    </article>
  );
}
