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

  const { error } = await supabase
    .from("post_reports")
    .update(reviewFields)
    .eq("id", cleanReportId);

  if (error) {
    console.error("UPDATE POST REPORT STATUS ERROR:", error);

    return {
      ok: false,
      message: "Could not update report status.",
    };
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin");

  return {
    ok: true,
    message: "Report status updated.",
  };
}