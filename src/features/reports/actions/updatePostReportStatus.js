"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_STATUSES = new Set(["open", "reviewed", "dismissed", "actioned"]);

export async function updatePostReportStatus({ reportId, status }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: "You must be logged in to update reports.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .rpc("get_my_profile_auth_status")
    .maybeSingle();

  if (profileError) {
    console.error("UPDATE POST REPORT ROLE CHECK ERROR:", profileError);

    return {
      ok: false,
      message: "Could not verify report permissions.",
    };
  }

  const cleanRole =
    typeof profile?.role === "string" ? profile.role.trim().toLowerCase() : "";

  if (!["admin", "ceo"].includes(cleanRole)) {
    return {
      ok: false,
      message: "You do not have permission to update reports.",
    };
  }

  const cleanReportId = typeof reportId === "string" ? reportId.trim() : "";
  const cleanStatus = typeof status === "string" ? status.trim() : "";

  if (!cleanReportId) {
    return {
      ok: false,
      message: "Missing report ID.",
    };
  }

  if (!ALLOWED_STATUSES.has(cleanStatus)) {
    return {
      ok: false,
      message: "Invalid report status.",
    };
  }

  const reviewFields =
    cleanStatus === "open"
      ? {
          status: cleanStatus,
          reviewed_by: null,
          reviewed_at: null,
        }
      : {
          status: cleanStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        };

  const { data: updatedReport, error } = await supabase
    .from("post_reports")
    .update(reviewFields)
    .eq("id", cleanReportId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("UPDATE POST REPORT STATUS ERROR:", error);

    return {
      ok: false,
      message: "Could not update report status.",
    };
  }

  if (!updatedReport) {
    return {
      ok: false,
      message: "Report was not found or could not be updated.",
    };
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin");

  return {
    ok: true,
    message: "Report status updated.",
  };
}
