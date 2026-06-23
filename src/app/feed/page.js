import FeedPage from "@/features/feed/components/FeedPage";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const VALID_FEEDS = ["main", "friends", "trending"];

export default async function FeedRoute({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/welcome");
  }

  const params = await searchParams;
  const requestedFeed =
    typeof params?.feed === "string" ? params.feed : "main";
  const feedType = VALID_FEEDS.includes(requestedFeed)
    ? requestedFeed
    : "main";

  return <FeedPage feedType={feedType} />;
}
