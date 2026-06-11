"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { sendModerationEmail } from "@/lib/email/sendModerationEmail";

const ROLE_VALUES = new Set(["user", "moderator", "admin"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function normalizeExpiresAt(value) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  const date = new Date(cleaned);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function success(message, extra = {}) {
  revalidatePath("/admin/reports");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/profile");
  revalidatePath("/profile/notifications");
  revalidatePath("/");

  return {
    ok: true,
    message,
    ...extra,
  };
}

function failure(message, error = null) {
  if (error) {
    console.error("MODERATION ACTION ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  return {
    ok: false,
    message,
  };
}

async function callModerationRpc(rpcName, payload, successMessage) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return failure("You must be logged in to use moderation actions.");
  }

  const { data, error } = await supabase.rpc(rpcName, payload);

  if (error) {
    return failure(error.message || "Moderation action failed.", error);
  }

  return success(successMessage, {
    moderationEventId: data || null,
  });
}

async function sendAccountModerationEmail({ supabase, moderationEventId }) {
  if (!moderationEventId) {
    return {
      sent: false,
      skipped: true,
      error: "Missing moderation event id",
    };
  }

  const { data: emailContext, error: contextError } = await supabase
    .rpc("get_moderation_event_email_context", {
      p_event_id: moderationEventId,
    })
    .maybeSingle();

  if (contextError || !emailContext) {
    const message =
      contextError?.message || "Could not load moderation email context";

    console.error("MODERATION EMAIL CONTEXT ERROR:", {
      code: contextError?.code,
      message,
      details: contextError?.details,
      hint: contextError?.hint,
    });

    await supabase.rpc("mark_moderation_event_email_result", {
      p_event_id: moderationEventId,
      p_email_sent: false,
      p_email_error: message,
    });

    return {
      sent: false,
      skipped: false,
      error: message,
    };
  }

  const emailResult = await sendModerationEmail(emailContext);
  const emailError = emailResult.sent ? null : emailResult.error;

  const { error: markError } = await supabase.rpc(
    "mark_moderation_event_email_result",
    {
      p_event_id: moderationEventId,
      p_email_sent: emailResult.sent,
      p_email_error: emailError,
    },
  );

  if (markError) {
    console.error("MODERATION EMAIL RESULT UPDATE ERROR:", {
      code: markError.code,
      message: markError.message,
      details: markError.details,
      hint: markError.hint,
    });
  }

  return emailResult;
}

async function callModerationRpcWithEmailNotice({
  rpcName,
  payload,
  sentMessage,
  failedMessage,
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return failure("You must be logged in to use moderation actions.");
  }

  const { data: moderationEventId, error } = await supabase.rpc(
    rpcName,
    payload,
  );

  if (error) {
    return failure(error.message || "Moderation action failed.", error);
  }

  const emailResult = await sendAccountModerationEmail({
    supabase,
    moderationEventId,
  });

  return success(emailResult.sent ? sentMessage : failedMessage, {
    moderationEventId: moderationEventId || null,
    email: emailResult,
  });
}

export async function warnUser({
  targetUserId,
  reason,
  message,
  relatedPostId = null,
  relatedReportId = null,
}) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  return callModerationRpc(
    "moderation_warn_user",
    {
      p_target_user_id: targetUserId,
      p_reason: nullableString(reason),
      p_message: nullableString(message),
      p_related_post_id: relatedPostId || null,
      p_related_report_id: relatedReportId || null,
    },
    "Warning recorded.",
  );
}

export async function muteUser({
  targetUserId,
  reason,
  expiresAt = null,
  relatedPostId = null,
  relatedReportId = null,
}) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  return callModerationRpcWithEmailNotice({
    rpcName: "moderation_mute_user",
    payload: {
      p_target_user_id: targetUserId,
      p_reason: nullableString(reason),
      p_expires_at: normalizeExpiresAt(expiresAt),
      p_related_post_id: relatedPostId || null,
      p_related_report_id: relatedReportId || null,
    },
    sentMessage: "User muted and notice sent.",
    failedMessage: "User muted. Email notice could not be sent.",
  });
}

export async function unmuteUser({ targetUserId, reason }) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  return callModerationRpc(
    "moderation_unmute_user",
    {
      p_target_user_id: targetUserId,
      p_reason: nullableString(reason),
    },
    "User unmuted.",
  );
}

export async function banUser({
  targetUserId,
  reason,
  expiresAt = null,
  relatedPostId = null,
  relatedReportId = null,
}) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  return callModerationRpcWithEmailNotice({
    rpcName: "moderation_ban_user",
    payload: {
      p_target_user_id: targetUserId,
      p_reason: nullableString(reason),
      p_expires_at: normalizeExpiresAt(expiresAt),
      p_related_post_id: relatedPostId || null,
      p_related_report_id: relatedReportId || null,
    },
    sentMessage: "User banned and notice sent.",
    failedMessage: "User banned. Email notice could not be sent.",
  });
}

export async function unbanUser({ targetUserId, reason }) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  return callModerationRpc(
    "moderation_unban_user",
    {
      p_target_user_id: targetUserId,
      p_reason: nullableString(reason),
    },
    "User unbanned.",
  );
}

export async function removePost({ postId, reason, relatedReportId = null }) {
  if (!postId) {
    return failure("Missing post.");
  }

  const result = await callModerationRpc(
    "moderation_remove_post",
    {
      p_post_id: postId,
      p_reason: nullableString(reason),
      p_related_report_id: relatedReportId || null,
    },
    "Post removed.",
  );

  if (result.ok) {
    revalidatePath(`/posts/${postId}`);
  }

  return result;
}

export async function dismissReport({ reportId, reason }) {
  if (!reportId) {
    return failure("Missing report.");
  }

  return callModerationRpc(
    "moderation_update_report_status",
    {
      p_report_id: reportId,
      p_status: "dismissed",
      p_reason: nullableString(reason),
    },
    "Report dismissed.",
  );
}

export async function reviewReport({ reportId, reason }) {
  if (!reportId) {
    return failure("Missing report.");
  }

  return callModerationRpc(
    "moderation_update_report_status",
    {
      p_report_id: reportId,
      p_status: "reviewed",
      p_reason: nullableString(reason),
    },
    "Report marked reviewed.",
  );
}

export async function addAdminNote({
  targetUserId,
  note,
  relatedPostId = null,
  relatedReportId = null,
}) {
  if (!targetUserId) {
    return failure("Missing target user.");
  }

  if (!cleanString(note)) {
    return failure("Admin note is required.");
  }

  return callModerationRpc(
    "moderation_add_admin_note",
    {
      p_target_user_id: targetUserId,
      p_note: cleanString(note),
      p_related_post_id: relatedPostId || null,
      p_related_report_id: relatedReportId || null,
    },
    "Admin note added.",
  );
}

export async function updateUserRole({ targetUserId, newRole, reason }) {
  const cleanRole = cleanString(newRole).toLowerCase();

  if (!targetUserId) {
    return failure("Missing target user.");
  }

  if (!ROLE_VALUES.has(cleanRole)) {
    return failure("Invalid target role.");
  }

  return callModerationRpc(
    "moderation_update_user_role",
    {
      p_target_user_id: targetUserId,
      p_new_role: cleanRole,
      p_reason: nullableString(reason),
    },
    "User role updated.",
  );
}
