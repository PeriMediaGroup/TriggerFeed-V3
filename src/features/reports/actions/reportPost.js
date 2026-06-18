"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";

const ALLOWED_REASONS = new Set([
  "spam",
  "harassment",
  "threats",
  "illegal_content",
  "graphic_content",
  "scam",
  "other",
]);

export async function reportPost({ postId, reason, details = "" }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: "You must be logged in to report a post.",
    };
  }

  const cleanPostId = typeof postId === "string" ? postId.trim() : "";
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  const cleanDetails = typeof details === "string" ? details.trim() : "";

  if (!cleanPostId) {
    return {
      ok: false,
      message: "Missing post ID.",
    };
  }

  if (!ALLOWED_REASONS.has(cleanReason)) {
    return {
      ok: false,
      message: "Please select a valid report reason.",
    };
  }

  if (cleanDetails.length > 1000) {
    return {
      ok: false,
      message: "Report details must be 1000 characters or less.",
    };
  }

  const { error } = await supabase.from("post_reports").insert({
    post_id: cleanPostId,
    reporter_id: user.id,
    reason: cleanReason,
    details: cleanDetails || null,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "You already reported this post.",
      };
    }

    console.error("REPORT POST ERROR:", error);

    return {
      ok: false,
      message: getUserSafeErrorMessage(error, "Could not submit report."),
    };
  }

  revalidatePath("/");
  revalidatePath(`/posts/${cleanPostId}`);

  return {
    ok: true,
    message: "Report submitted.",
  };
}
