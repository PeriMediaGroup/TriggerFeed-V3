"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createComment({ postId, body }) {
  if (!postId) {
    return {
      success: false,
      error: "Missing post id",
    };
  }

  const cleanBody = body?.trim();

  if (!cleanBody) {
    return {
      success: false,
      error: "Comment cannot be empty",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "You must be logged in to comment",
    };
  }

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: user.id,
    body: cleanBody,
  });

  if (error) {
    console.error("Error creating comment:", error);

    return {
      success: false,
      error: error.message,
    };
  }

  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    error: null,
  };
}