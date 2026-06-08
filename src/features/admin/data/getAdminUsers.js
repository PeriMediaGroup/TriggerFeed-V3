import { createClient } from "@/lib/supabase/server";

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export async function getAdminUsers({ query = "" } = {}) {
  const supabase = await createClient();

  const { data: users, error } = await supabase.rpc("search_admin_users", {
    p_query: query,
    p_limit: 50,
  });

  if (error) {
    logSupabaseError("SEARCH ADMIN USERS ERROR:", error);

    return {
      users: [],
      error,
    };
  }

  const safeUsers = users || [];
  const userIds = safeUsers.map((user) => user.id).filter(Boolean);
  const historyByUserId = await getModerationHistoryByUserId({
    supabase,
    userIds,
  });

  return {
    users: safeUsers.map((user) => ({
      ...user,
      moderation_history: historyByUserId.get(user.id) || [],
    })),
    error: null,
  };
}

async function getModerationHistoryByUserId({ supabase, userIds }) {
  if (!userIds.length) {
    return new Map();
  }

  const { data: actions, error } = await supabase
    .from("moderation_actions")
    .select(
      `
      id,
      target_user_id,
      actor_user_id,
      related_post_id,
      related_report_id,
      action_type,
      reason,
      message,
      expires_at,
      created_at
    `,
    )
    .in("target_user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    logSupabaseError("GET ADMIN USER MODERATION HISTORY ERROR:", error);
    return new Map();
  }

  const actorIds = [
    ...new Set((actions || []).map((action) => action.actor_user_id).filter(Boolean)),
  ];

  let actorMap = new Map();

  if (actorIds.length) {
    const { data: actors, error: actorsError } = await supabase.rpc(
      "get_public_profile_cards",
      {
        p_profile_ids: actorIds,
      },
    );

    if (actorsError) {
      logSupabaseError("GET ADMIN USER HISTORY ACTORS ERROR:", actorsError);
    }

    actorMap = new Map((actors || []).map((actor) => [actor.id, actor]));
  }

  const grouped = new Map();

  for (const action of actions || []) {
    const current = grouped.get(action.target_user_id) || [];

    if (current.length < 5) {
      current.push({
        ...action,
        actor: actorMap.get(action.actor_user_id) || null,
      });
    }

    grouped.set(action.target_user_id, current);
  }

  return grouped;
}
