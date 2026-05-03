import CommentItem from "@/features/comments/components/CommentItem";

export default function CommentList({
  comments = [],
  currentUserId = null,
  postId,
}) {
  const repliesByParentId = new Map();

  for (const comment of comments) {
    if (comment.parent_comment_id) {
      const existingReplies = repliesByParentId.get(comment.parent_comment_id) || [];
      repliesByParentId.set(comment.parent_comment_id, [
        ...existingReplies,
        comment,
      ]);
    }
  }

  const topLevelComments = comments.filter((comment) => {
    if (comment.parent_comment_id) {
      return false;
    }

    const replies = repliesByParentId.get(comment.id) || [];
    const hasReplies = replies.length > 0;

    if (comment.is_deleted && !hasReplies) {
      return false;
    }

    return true;
  });

  const visibleTopLevelCommentCount = comments.filter(
    (comment) => !comment.parent_comment_id && !comment.is_deleted
  ).length;

  if (!topLevelComments.length) {
    return (
      <section className="comments-list">
        <h2 className="comments-list__title">
          Comments <span>(0)</span>
        </h2>

        <p className="comments-list__empty">No comments yet.</p>
      </section>
    );
  }

  return (
    <section className="comments-list">
      <p className="comments-list__title">
        Comments
      </p>

      <ul className="comments-list__items">
        {topLevelComments.map((comment) => {
          const replies = repliesByParentId.get(comment.id) || [];

          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={replies}
              currentUserId={currentUserId}
              postId={postId}
            />
          );
        })}
      </ul>
    </section>
  );
}