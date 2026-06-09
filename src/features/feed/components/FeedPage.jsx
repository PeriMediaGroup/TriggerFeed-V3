import FeedTabs from "./FeedTabs";
import { getPosts } from "@/features/posts/data/getPosts";
import PostFeed from "@/features/posts/components/PostFeed";

const VALID_FEEDS = ["main", "friends", "trending"];

export default async function FeedPage({ feedType = "main" }) {
  const activeFeed = VALID_FEEDS.includes(feedType) ? feedType : "main";

  const {
    posts,
    commentsByPostId,
    currentUserId,
    message,
  } = await getPosts({ feedType: activeFeed });

  return (
    <section className="feed-page">
      <FeedTabs activeFeed={activeFeed} />

      {message ? (
        <div className="feed-page__notice">
          <p>{message}</p>
        </div>
      ) : null}

      <PostFeed
        posts={posts}
        commentsByPostId={commentsByPostId}
        currentUserId={currentUserId}
      />
    </section>
  );
}
