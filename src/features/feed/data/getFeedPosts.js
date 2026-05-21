import { createClient } from "@/lib/supabase/server";

const POST_SELECT = "*";

export async function getFeedPosts(feedType = "main") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id ?? null;

  if (feedType === "friends") {
    if (!currentUserId) {
      return {
        posts: [],
        commentsByPostId: {},
        currentUserId,
        message: "Log in to see posts from friends.",
      };
    }

    return getFriendsFeedPosts(supabase, currentUserId);
  }

  if (feedType === "trending") {
    return getTrendingFeedPosts(supabase, currentUserId);
  }

  return getMainFeedPosts(supabase, currentUserId);
}

async function getMainFeedPosts(supabase, currentUserId) {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("visibility", "public")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET MAIN FEED POSTS ERROR:", error);

    return {
      posts: [],
      message: "Could not load the main feed.",
    };
  }

  return {
    posts: data ?? [],
    message: "",
  };
}

async function getFriendsFeedPosts(supabase, userId) {
  const { data: friendships, error: friendsError } = await supabase
    .from("friends")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");

  if (friendsError) {
    console.error("GET FRIENDS FOR FEED ERROR:", friendsError);

    return {
      posts: [],
      message: "Could not load your friends feed.",
    };
  }

  const friendIds = (friendships ?? [])
    .map((friendship) => {
      if (friendship.requester_id === userId) {
        return friendship.addressee_id;
      }

      return friendship.requester_id;
    })
    .filter(Boolean);

  const allowedUserIds = [userId, ...friendIds];

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("visibility", "public")
    .eq("is_deleted", false)
    .in("user_id", allowedUserIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET FRIENDS FEED POSTS ERROR:", error);

    return {
      posts: [],
      message: "Could not load your friends feed.",
    };
  }

  return {
    posts: data ?? [],
    message:
      friendIds.length === 0
        ? "You do not have friend posts yet. Go make some friends. Horrifying, but useful."
        : "",
  };
}

async function getTrendingFeedPosts(supabase, currentUserId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("visibility", "public")
    .eq("is_deleted", false)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET TRENDING FEED POSTS ERROR:", error);

    return {
      posts: [],
      message: "Could not load trending posts.",
    };
  }

  return {
    posts: data ?? [],
    message: "",
  };
}