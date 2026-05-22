import FeedPage from "@/features/feed/components/FeedPage";

const VALID_FEEDS = ["main", "friends", "trending"];

export default async function Home({ searchParams }) {
  const params = await searchParams;

  const requestedFeed =
    typeof params?.feed === "string" ? params.feed : "main";

  const feedType = VALID_FEEDS.includes(requestedFeed)
    ? requestedFeed
    : "main";

  return <FeedPage feedType={feedType} />;
}