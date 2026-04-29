// src/features/posts/actions/createPost.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePostInput } from "../utils/validatePost";

export async function createPost(formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to create a post.",
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
      user_id: user.id,
      event_type: "post_create_failed",
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

  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: validation.values.title,
      body: validation.values.body,
      visibility: validation.values.visibility,
    })
    .select("id")
    .single();

  if (error) {
    console.error("CREATE POST INSERT ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    const { error: auditError } = await supabase.from("post_audit_logs").insert({
      user_id: user.id,
      event_type: "post_create_failed",
      success: false,
      error_code: error.code,
      error_message: error.message,
      metadata: {
        source: "createPost",
        details: error.details,
        hint: error.hint,
      },
    });

    if (auditError) {
      console.error("POST AUDIT LOG ERROR:", {
        code: auditError.code,
        message: auditError.message,
        details: auditError.details,
        hint: auditError.hint,
      });
    }

    return {
      success: false,
      message: "Post could not be created.",
    };
  }

  await supabase.from("post_audit_logs").insert({
    post_id: data.id,
    user_id: user.id,
    event_type: "post_create_success",
    success: true,
    metadata: {
      source: "createPost",
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");

  return {
    success: true,
    postId: data.id,
  };
}