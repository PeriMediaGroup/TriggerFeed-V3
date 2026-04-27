// src/features/posts/actions/deletePost.js

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deletePost(postId) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to delete a post.",
    };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", postId)
    .eq("user_id", user.id)
    .eq("is_deleted", false);

  if (error) {
    await supabase.from("post_audit_logs").insert({
      post_id: postId,
      user_id: user.id,
      event_type: "post_delete_failed",
      success: false,
      error_code: error.code,
      error_message: error.message,
      metadata: {
        source: "deletePost",
      },
    });

    return {
      success: false,
      message: "Post could not be deleted.",
    };
  }

  await supabase.from("post_audit_logs").insert({
    post_id: postId,
    user_id: user.id,
    event_type: "post_delete_success",
    success: true,
    metadata: {
      source: "deletePost",
    },
  });

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  redirect("/posts");
}