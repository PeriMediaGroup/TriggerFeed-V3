import CommentItem from "./CommentItem";

export default function CommentList({ comments = [] }) {
  if (!comments.length) {
    return (
      <section className="comments-list">
        <p className="comments-list__empty">
          No comments yet. Be the first to start the conversation.
        </p>
      </section>
    );
  }

  return (
    <section className="comments-list" aria-label="Comments">
      <h3 className="comments-list__title">Comments :</h3>

      <div className="comments-list__items">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </section>
  );
}