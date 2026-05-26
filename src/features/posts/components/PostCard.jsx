"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DeletePostButton from "./DeletePostButton";
import { MessageSquare } from "lucide-react";

import { formatRelativeTime } from "@/lib/formatDate";
import MediaGallery from "@/features/media/components/MediaGallery";
import SmartText from "@/components/ui/SmartText";
import SharePostButton from "./SharePostButton";
import PostVoteButtons from "@/features/votes/components/PostVoteButtons";
import PollDisplay from "@/features/polls/components/PollDisplay";
import ReportPostButton from "@/features/reports/components/ReportPostButton";

export default function PostCard({
  post,
  currentUserId = null,
  variant = "feed",
  children,
  hideCommentsToggle = false,
}) {
  const [showComments, setShowComments] = useState(false);

  const avatarUrl =
    post.author?.avatar_cloudinary_url || post.avatarUrl || null;

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
    post.post_media || post.media || post.images || post.post_images || [];
  const mentionProfiles = post.mentionProfiles || [];
  const poll = post.polls?.[0] || null;

  return (
    <>
      <article className="post-card">
        <header className="post-card__header">
          <div className="post-card__header-avatar">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${displayName} avatar`}
                width={50}
                height={50}
                className="post-card__header-avatar-image"
              />
            ) : (
              <Image
                className="post-card__header-avatar-image"
                src="https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png"
                alt="Default Avatar"
                width="150"
                height="150"
              />
            )}{" "}
          </div>
          <div className="post-card__header-name">
            {authorId ? (
              <>
                <strong className="post-card__author-display-name">
                  {displayName}
                </strong>

                <Link
                  href={`/profiles/${authorId}`}
                  className="post-card__author-username"
                >
                  {authorName}
                </Link>
              </>
            ) : (
              <>
                <strong>{displayName}</strong>
                {authorName}
              </>
            )}
            <p className="post-card__date" suppressHydrationWarning>
              {formatRelativeTime(post.created_at)}
            </p>
          </div>
          <div className="post-card__header-tools">
            <SharePostButton postId={post.id} />
            <ReportPostButton
              postId={post.id}
              viewerHasReported={post.viewer_has_reported}
            />
          </div>
        </header>

        <h2 className="post-card__title">
          <SmartText text={post.title} mentionProfiles={mentionProfiles} />
        </h2>
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
            {showComments ? `Hide comments` : `(${commentCount}) Add comments`}
          </button>
        )}

        {showComments && (
          <div className="post-card__comments-panel">{children}</div>
        )}

        <footer className="post-card__footer">
          {variant === "feed" && (
            <Link href={`/posts/${post.id}`} className="post-card__detail-link">
              View post
            </Link>
          )}
        </footer>
      </article>
    </>
  );
}
