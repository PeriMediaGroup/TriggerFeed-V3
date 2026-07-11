import { createClient } from "@/lib/supabase/server";

const EMPTY_ADMIN_ACTIVITY_OVERVIEW = {
  onlineNow: 0,
  active7Days: 0,
  new7Days: 0,
  totalUsers: 0,
  recentUsers: [],
};

function toSafeCount(value) {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function normalizeRecentUser(user) {
  return {
    userId: user?.user_id || "",
    username: user?.username || "",
    displayName: user?.display_name || "",
    avatarUrl: user?.avatar_cloudinary_url || "",
    role: user?.role || "user",
    lastSeenAt: user?.last_seen_at || null,
    lastLoginAt: user?.last_login_at || null,
    joinedAt: user?.joined_at || null,
    isBanned: user?.is_banned === true,
    isMuted: user?.is_muted === true,
    isDeleted: user?.is_deleted === true,
  };
}

export function normalizeAdminActivityOverview(data) {
  return {
    onlineNow: toSafeCount(data?.online_now),
    active7Days: toSafeCount(data?.active_7_days),
    new7Days: toSafeCount(data?.new_7_days),
    totalUsers: toSafeCount(data?.total_users),
    recentUsers: Array.isArray(data?.recent_users)
      ? data.recent_users.map(normalizeRecentUser).filter((user) => user.userId)
      : [],
  };
}

export async function getAdminActivityOverview({
  supabase: providedClient,
  recentLimit = 10,
} = {}) {
  const supabase = providedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("get_admin_activity_overview", {
    p_recent_limit: recentLimit,
  });

  if (error) {
    console.error("GET ADMIN ACTIVITY OVERVIEW ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      overview: EMPTY_ADMIN_ACTIVITY_OVERVIEW,
      error,
    };
  }

  return {
    overview: normalizeAdminActivityOverview(data),
    error: null,
  };
}
