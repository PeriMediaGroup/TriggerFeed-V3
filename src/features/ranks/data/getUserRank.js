import { createClient } from "@/lib/supabase/server";

function normalizeRank(row) {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    postCount: row.post_count ?? 0,
    rankKey: row.rank_key || "",
    rankLabel: row.rank_label || "New Recruit",
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

export function isHigherRank(rankKey, previousRankKey, rankSortOrderMap) {
  if (!rankKey || !rankSortOrderMap?.has(rankKey)) {
    return false;
  }

  const currentSortOrder = rankSortOrderMap.get(rankKey) || 0;
  const previousSortOrder = previousRankKey
    ? rankSortOrderMap.get(previousRankKey) || 0
    : 0;

  return currentSortOrder > previousSortOrder;
}
