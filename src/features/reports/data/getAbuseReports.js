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

export async function getAbuseReports() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("abuse_reports")
    .select(
      `
      id,
      email,
      link,
      offending_username,
      details,
      source,
      status,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logSupabaseError("GET ABUSE REPORTS ERROR:", error);
    return [];
  }

  return data || [];
}
