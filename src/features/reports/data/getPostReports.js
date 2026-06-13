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

export async function getPostReports() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_post_reports_for_moderation",
  );

  if (error) {
    logSupabaseError("GET POST REPORTS ERROR:", error);
    return [];
  }

  const reports = data || [];
  const targetUserIds = [
    ...new Set(reports.map((report) => report.post?.user_id).filter(Boolean)),
  ];

  const moderationHistoryByUserId = await getModerationHistoryByUserId({
    supabase,
    targetUserIds,
  });

  return reports.map((report) => ({
    ...report,
    moderation_history: moderationHistoryByUserId.get(report.post?.user_id) || [],
  }));
}

async function getModerationHistoryByUserId({ supabase, targetUserIds }) {
  if (!targetUserIds.length) {
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
    `
    )
    .in("target_user_id", targetUserIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    logSupabaseError("GET MODERATION HISTORY ERROR:", error);
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
      }
    );

    if (actorsError) {
      logSupabaseError("GET MODERATION HISTORY ACTORS ERROR:", actorsError);
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
