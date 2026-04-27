// src/features/posts/actions/updatePost.js

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePostInput } from "../utils/validatePost";

export async function updatePost(postId, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to edit a post.",
    };
  }

  const rawPost = {
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  };

  const validation = validatePostInput(rawPost);

  if (!validation.isValid) {
    await supabase.from("post_audit_logs").insert({
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: "validation_error",
      error_message: "Post validation failed.",
      metadata: {
        errors: validation.errors,
      },
    });

    return {
      success: false,
      message: "Please fix the post errors.",
      errors: validation.errors,
    };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      title: validation.values.title,
      body: validation.values.body,
      visibility: validation.values.visibility,
    })
    .eq("id", postId)
    .eq("user_id", user.id)
    .eq("is_deleted", false);

  if (error) {
    await supabase.from("post_audit_logs").insert({
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: error.code,
      error_message: error.message,
      metadata: {
        source: "updatePost",
      },
    });

    return {
      success: false,
      message: "Post could not be updated.",
    };
  }

  await supabase.from("post_audit_logs").insert({
    post_id: postId,
    user_id: user.id,
    event_type: "post_update_success",
    success: true,
    metadata: {
      source: "updatePost",
    },
  });

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  redirect(`/posts/${postId}`);
}