import { Fragment } from "react";
import { FeedAdSlot } from "@/features/ads/FeedAds";
// src/features/posts/components/PostFeed.jsx

import PostCard from "./PostCard";
import CommentList from "@/features/comments/components/CommentList";
import CommentForm from "@/features/comments/components/CommentForm";

export default function PostFeed({
  posts,
  showAds = false,
  commentsByPostId = {},
  currentUserId = null,
}) {
  if (!posts?.length) {
    return <p>No posts yet.</p>;
  }

  return (
    <div className="post-feed">
      {posts.map((post, index) => {
        const comments = commentsByPostId[post.id] || [];

        return (
          <Fragment key={post.id}>
          <PostCard
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
          {showAds ? <FeedAdSlot after={index + 1} /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
