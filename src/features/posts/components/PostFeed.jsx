// src/features/posts/components/PostFeed.jsx

import PostCard from "./PostCard";

export default function PostFeed({ posts }) {
  if (!posts?.length) {
    return <p>No posts yet. Humanity remains quiet, somehow.</p>;
  }

  return (
    <div className="post-feed">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}