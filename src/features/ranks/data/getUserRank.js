import { createClient } from "@/lib/supabase/server";

export const BASE_RANK_KEY = "FNG";
export const BASE_RANK_MIN_POSTS = 0;

function normalizeRank(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    postCount: row.post_count ?? 0,
    rankKey: row.rank_key || "",
    rankLabel: row.rank_label || "FNG",
    nextRankKey: row.next_rank_key || null,
    nextRankLabel: row.next_rank_label || null,
    nextRankMinPosts: row.next_rank_min_posts ?? null,
    postsUntilNextRank: row.posts_until_next_rank ?? 0,
  };
}

export async function getUserRank(userId) {
  if (!userId) {
    return {
      rank: null,
      error: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_user_rank", {
      p_user_id: userId,
    })
    .maybeSingle();

  if (error) {
    console.error("GET USER RANK ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      rank: null,
      error,
    };
  }

  return {
    rank: normalizeRank(data),
    error: null,
  };
}

export async function getRankSortOrderMap() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_rank_thresholds")
    .select("key, sort_order")
    .eq("is_active", true);

  if (error) {
    console.error("GET RANK SORT ORDERS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return new Map();
  }

  return new Map((data || []).map((rank) => [rank.key, rank.sort_order]));
}

export async function getRankThresholdMap() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_rank_thresholds")
    .select("key, min_posts, sort_order")
    .eq("is_active", true);

  if (error) {
    console.error("GET RANK THRESHOLDS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return new Map();
  }

  return new Map(
    (data || []).map((rank) => [
      rank.key,
      {
        minPosts: rank.min_posts ?? 0,
        sortOrder: rank.sort_order ?? 0,
      },
    ]),
  );
}

function getRankSortOrder(rankKey, rankThresholdMap) {
  const rankThreshold = rankThresholdMap?.get(rankKey);

  if (typeof rankThreshold === "number") {
    return rankThreshold;
  }

  return rankThreshold?.sortOrder ?? 0;
}

export function isHigherRank(rankKey, previousRankKey, rankSortOrderMap) {
  if (!rankKey || !rankSortOrderMap?.has(rankKey)) {
    return false;
  }

  const currentSortOrder = getRankSortOrder(rankKey, rankSortOrderMap);
  const previousSortOrder =
    previousRankKey && rankSortOrderMap.has(previousRankKey)
      ? getRankSortOrder(previousRankKey, rankSortOrderMap)
      : 0;

  return currentSortOrder > previousSortOrder;
}

export function isMilestoneEligibleRank(rankKey, rankThresholdMap) {
  if (!rankKey || rankKey === BASE_RANK_KEY) {
    return false;
  }

  const rankThreshold = rankThresholdMap?.get(rankKey);

  if (!rankThreshold) {
    return false;
  }

  const minPosts =
    typeof rankThreshold === "number"
      ? null
      : rankThreshold.minPosts ?? BASE_RANK_MIN_POSTS;

  return minPosts !== BASE_RANK_MIN_POSTS;
}
