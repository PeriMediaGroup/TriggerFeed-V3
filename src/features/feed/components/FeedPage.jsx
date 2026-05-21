import FeedTabs from "./FeedTabs";
import { getFeedPosts } from "../data/getFeedPosts";
import PostFeed from "@/features/posts/components/PostFeed";

const VALID_FEEDS = ["main", "friends", "trending"];

export default async function FeedPage({ feedType = "main" }) {
  const activeFeed = VALID_FEEDS.includes(feedType) ? feedType : "main";

  const { posts, message } = await getFeedPosts(activeFeed);

  return (
    <section className="feed-page">
      <FeedTabs activeFeed={activeFeed} />

      {message ? (
        <div className="feed-page__notice">
          <p>{message}</p>
        </div>
      ) : null}

      <PostFeed posts={posts} />
    </section>
  );
}