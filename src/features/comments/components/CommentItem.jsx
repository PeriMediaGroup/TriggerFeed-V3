// src/features/comments/components/CommentItem.jsx

"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageSquareReply, Pencil, Trash2 } from "lucide-react";

import { formatShortDate, formatEditedDate } from "@/lib/formatDate";
import SmartText from "@/components/ui/SmartText";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

import {
  createComment,
  updateComment,
  deleteComment,
} from "@/features/comments/actions";

function getAuthorName(author) {
  return (
    author?.display_name ||
    author?.username ||
    author?.first_name ||
    "Unknown user"
  );
}

export default function CommentItem({
  comment,
  replies = [],
  currentUserId = null,
  postId,
  isReply = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body || "");
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const isOwner = currentUserId && currentUserId === comment.user_id;

  const authorName = getAuthorName(comment.author);

  const authorUsername = comment.author?.username
    ? `@${comment.author.username}`
    : "";

  const authorAvatarUrl =
    comment.author?.avatar_cloudinary_url ||
    comment.author?.profile_image_url ||
    "";

  const authorInitial = authorName?.charAt(0)?.toUpperCase() || "?";
  const isDeletedAuthor = Boolean(comment.author?.is_deleted);

  const authorHref = !isDeletedAuthor && comment.author?.id
    ? `/profiles/${comment.author.id}`
    : !isDeletedAuthor
      ? `/profiles/${comment.user_id}`
      : null;

  function handleEditSubmit(event) {
    event.preventDefault();

    const trimmedBody = editBody.trim();

    if (!trimmedBody) {
      setStatus("Comment cannot be empty.");
      return;
    }

    setStatus("");

    startTransition(async () => {
      const result = await updateComment({
        commentId: comment.id,
        body: trimmedBody,
      });

      if (!result.success) {
        setStatus(result.error || "Could not update comment.");
        return;
      }

      setIsEditing(false);
      setStatus("");
    });
  }

  function handleDelete() {
    const confirmed = window.confirm("Delete this comment?");

    if (!confirmed) return;

    setStatus("");

    startTransition(async () => {
      const result = await deleteComment({
        commentId: comment.id,
      });

      if (!result.success) {
        setStatus(result.error || "Could not delete comment.");
      }
    });
  }

  function handleReplySubmit(event) {
    event.preventDefault();

    const trimmedBody = replyBody.trim();

    if (!trimmedBody) {
      setStatus("Reply cannot be empty.");
      return;
    }

    setStatus("");

    startTransition(async () => {
      const result = await createComment({
        postId,
        body: trimmedBody,
        parentCommentId: comment.id,
      });

      if (!result.success) {
        setStatus(result.error || "Could not add reply.");
        return;
      }

      setReplyBody("");
      setIsReplying(false);
      setStatus("");
    });
  }

  return (
    <li
      id={`comment-${comment.id}`}
      className={isReply ? "comment-item comment-item--reply" : "comment-item"}
    >
      <article className="comment-item__content">
        <span
          className="comment-item__avatar-link"
          aria-label={authorHref ? `View ${authorName}'s profile` : undefined}
        >
          {authorAvatarUrl ? (
            <Image
              src={authorAvatarUrl}
              alt={`${authorName} avatar`}
              width={40}
              height={40}
              className="comment-item__avatar"
            />
          ) : (
            <Image
              className="post-card__header-avatar-image"
              src="https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png"
              alt="Default Avatar"
              width="40"
              height="40"
            />
          )}
        </span>

        <div className="comment-item__main">
          <header className="comment-item__header">
            {authorHref ? (
              <Link href={authorHref} className="comment-item__name">
                <strong>{authorName}</strong>
              </Link>
            ) : (
              <strong className="comment-item__name">{authorName}</strong>
            )}

            {authorUsername && authorHref && (
              <Link href={authorHref} className="comment-item__username">
                {authorUsername}
              </Link>
            )}

            <time dateTime={comment.created_at} className="comment-item__date">
              {formatShortDate(comment.created_at)}
            </time>

            {comment.updated_at &&
              comment.updated_at !== comment.created_at &&
              !comment.is_deleted && (
                <span className="comment-item__edited">
                  {formatEditedDate(comment.updated_at)}
                </span>
              )}
          </header>

          {comment.is_deleted ? (
            <p className="comment-item__deleted">
              {isReply ? "Reply removed." : "Comment removed."}
            </p>
          ) : isEditing ? (
            <form
              onSubmit={handleEditSubmit}
              className="comment-item__edit-form"
            >
              <label htmlFor={`edit-comment-${comment.id}`}>Edit comment</label>

              <MentionTextarea
                id={`edit-comment-${comment.id}`}
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                maxLength={5000}
                placeholder="Edit your comment..."
              />

              <div className="comment-item__actions">
                <button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setEditBody(comment.body || "");
                    setIsEditing(false);
                    setStatus("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div id={`comment-${comment.id}`} className="comment-item__body">
              <SmartText text={comment.body} />
            </div>
          )}

          {!comment.is_deleted && (
            <div className="comment-item__actions">
              {!isReply && currentUserId && (
                <button
                  type="button"
                  className="comment-item__action-button"
                  disabled={isPending}
                  onClick={() => setIsReplying((current) => !current)}
                  aria-label="Reply to comment"
                >
                  <MessageSquareReply
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                  />{" "}
                  Reply
                </button>
              )}

              {isOwner && !isEditing && (
                <>
                  <button
                    type="button"
                    className="comment-item__icon-button"
                    disabled={isPending}
                    onClick={() => setIsEditing(true)}
                    aria-label="Edit comment"
                  >
                    <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    className="comment-item__icon-button"
                    disabled={isPending}
                    onClick={handleDelete}
                    aria-label="Delete comment"
                  >
                    <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}

          {isReplying && !comment.is_deleted && (
            <form
              onSubmit={handleReplySubmit}
              className="comment-item__reply-form"
            >
              <label htmlFor={`reply-comment-${comment.id}`}>
                Reply to {authorName}
              </label>

              <MentionTextarea
                id={`reply-comment-${comment.id}`}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                maxLength={5000}
                placeholder="Write a reply..."
              />

              <div className="comment-item__actions">
                <button type="submit" disabled={isPending}>
                  {isPending ? "Replying..." : "Post Reply"}
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setReplyBody("");
                    setIsReplying(false);
                    setStatus("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {status && <p className="comment-item__status">{status}</p>}
        </div>
      </article>

      {!isReply && replies.length > 0 && (
        <ul className="comment-item__replies">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              currentUserId={currentUserId}
              postId={postId}
              isReply
            />
          ))}
        </ul>
      )}
    </li>
  );
}
