// src/features/posts/components/PostFeed.jsx

import PostCard from "./PostCard";
import CommentList from "@/features/comments/components/CommentList";
import CommentForm from "@/features/comments/components/CommentForm";

export default function PostFeed({
  posts,
  commentsByPostId = {},
  currentUserId = null,
}) {
  if (!posts?.length) {
    return <p>No posts yet.</p>;
  }

  return (
    <div className="post-feed">
      {posts.map((post) => {
        const comments = commentsByPostId[post.id] || [];

        return (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
          >

            <CommentList
              comments={comments}
              currentUserId={currentUserId}
              postId={post.id}
            />
            <CommentForm
              postId={post.id}
              isLoggedIn={Boolean(currentUserId)}
            />
          </PostCard>
        );
      })}
    </div>
  );
}
