import Link from "next/link";
import Image from "next/image";

export default function CommentItem({ comment }) {
  const authorName =
    comment.author?.username || comment.author?.first_name || "Unknown user";

  const authorId = comment.user_id || comment.author?.id;

  const createdAt = comment.created_at
    ? new Date(comment.created_at).toLocaleString()
    : "";

  return (
    <article className="comment-item">
      <header className="comment-item__header">
        <div className="comment-item__author">
          {comment.author?.profile_image_url ? (
            <Image
              className="comment-item__avatar"
              src={comment.author.profile_image_url}
              alt=""
            />
          ) : (
            <div className="comment-item__avatar comment-item__avatar--fallback">
              {/* TODO: Replace fallback initial with default avatar image */}
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <p className="comment-item__name">
              {authorId ? (
                <Link href={`/users/${authorId}`}>{authorName}</Link>
              ) : (
                authorName
              )}
            </p>
            {createdAt && (
              <time
                className="comment-item__date"
                dateTime={comment.created_at}
              >
                {createdAt}
              </time>
            )}
          </div>
        </div>
      </header>

      <p className="comment-item__body">{comment.body}</p>
    </article>
  );
}
