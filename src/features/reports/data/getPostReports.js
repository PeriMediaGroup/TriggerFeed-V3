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

  const { data, error } = await supabase
    .from("post_reports")
    .select(`
      id,
      post_id,
      reporter_id,
      reason,
      details,
      status,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at,
      post:posts (
        id,
        title,
        body,
        user_id,
        created_at
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("GET POST REPORTS ERROR:", error);
    return [];
  }

  const reports = data || [];
  const profileIds = [
    ...new Set(
      reports
        .flatMap((report) => [report.reporter_id, report.reviewed_by])
        .filter(Boolean)
    ),
  ];

  if (!profileIds.length) {
    return reports.map((report) => ({
      ...report,
      reporter: null,
      reviewer: null,
    }));
  }

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_public_profile_cards",
    {
      p_profile_ids: profileIds,
    }
  );

  if (profilesError) {
    logSupabaseError("GET POST REPORT PROFILE CARDS ERROR:", profilesError);

    return reports.map((report) => ({
      ...report,
      reporter: null,
      reviewer: null,
    }));
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  return reports.map((report) => ({
    ...report,
    reporter: profileMap.get(report.reporter_id) || null,
    reviewer: profileMap.get(report.reviewed_by) || null,
  }));
}
