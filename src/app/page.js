import FeedPage from "../features/feed/components/FeedPage";

export default function Home({ searchParams }) {
  const feedType = searchParams?.feed || "main";

  return <FeedPage feedType={feedType} />;
}
