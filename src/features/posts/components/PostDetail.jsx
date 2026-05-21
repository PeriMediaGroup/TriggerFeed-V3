import PostCard from "@/features/posts/components/PostCard";

export default function PostDetail({ post, currentUserId }) {
  return (
    <article className="post-detail">
      <PostCard
        key={post.id}
        post={post}
        currentUserId={currentUserId}
        variant="detail"
        hideCommentsToggle
      />
    </article>
  );
}
