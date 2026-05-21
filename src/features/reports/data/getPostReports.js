import { createClient } from "@/lib/supabase/server";

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
      ),
      reporter:profiles!post_reports_reporter_id_fkey (
        id,
        username,
        display_name,
        first_name,
        last_name,
        avatar_cloudinary_url
      ),
      reviewer:profiles!post_reports_reviewed_by_fkey (
        id,
        username,
        display_name,
        first_name,
        last_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET POST REPORTS ERROR:", error);
    return [];
  }

  return data || [];
}