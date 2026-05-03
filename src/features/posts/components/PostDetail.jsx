import PostCard from "@/features/posts/components/PostCard";

export default function PostDetail({ post, currentUser }) {

  return (
    <article className="post-detail">
      <PostCard key={post.id} post={post} />
    </article>
  );
}