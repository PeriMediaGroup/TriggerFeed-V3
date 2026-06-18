"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";

const ALLOWED_STATUSES = new Set([
  "new",
  "reviewing",
  "reviewed",
  "dismissed",
  "action_taken",
]);

const STATUS_MESSAGES = {
  new: "Abuse report reopened.",
  reviewing: "Abuse report marked reviewing.",
  reviewed: "Abuse report marked reviewed.",
  dismissed: "Abuse report dismissed.",
  action_taken: "Abuse report marked action taken.",
};

export async function updateAbuseReportStatus({ reportId, status }) {
  const cleanReportId = typeof reportId === "string" ? reportId.trim() : "";
  const cleanStatus = typeof status === "string" ? status.trim() : "";

  if (!cleanReportId || !ALLOWED_STATUSES.has(cleanStatus)) {
    return {
      ok: false,
      message: "Unsupported abuse report status.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: "You must be logged in to update abuse reports.",
    };
  }

  const { error } = await supabase
    .from("abuse_reports")
    .update({
      status: cleanStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", cleanReportId);

  if (error) {
    console.error("UPDATE ABUSE REPORT STATUS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      reportId: cleanReportId,
      status: cleanStatus,
    });

    return {
      ok: false,
      message: getUserSafeErrorMessage(
        error,
        "Could not update abuse report.",
        "You do not have permission to update abuse reports.",
      ),
    };
  }

  revalidatePath("/admin/reports");

  return {
    ok: true,
    message: STATUS_MESSAGES[cleanStatus] || "Abuse report updated.",
  };
}
