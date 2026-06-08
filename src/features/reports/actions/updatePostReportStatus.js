"use server";

import {
  dismissReport,
  reviewReport,
} from "@/features/admin/actions/moderationActions";

export async function updatePostReportStatus({ reportId, status }) {
  if (status === "reviewed") {
    return reviewReport({
      reportId,
      reason: "Status updated from reports panel.",
    });
  }

  if (status === "dismissed") {
    return dismissReport({
      reportId,
      reason: "Status updated from reports panel.",
    });
  }

  return {
    ok: false,
    message: "Unsupported report status update.",
  };
}
