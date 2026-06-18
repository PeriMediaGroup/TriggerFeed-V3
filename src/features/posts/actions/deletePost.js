"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";

export async function deletePost(postId) {
  if (!postId) {
    return {
      success: false,
      error: "Missing post id",
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
      error: "You must be logged in to delete a post.",
    };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id, is_deleted")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    console.error("Error checking post before delete:", postError);

    return {
      success: false,
      error: getUserSafeErrorMessage(postError, "Could not remove post."),
    };
  }

  if (!post) {
    return {
      success: false,
      error: "Post not found.",
    };
  }

  if (post.user_id !== user.id) {
    return {
      success: false,
      error: "You can only delete your own posts.",
    };
  }

  if (post.is_deleted) {
    return {
      success: true,
      error: null,
    };
  }

  const { error: deleteError } = await supabase.rpc("soft_delete_post", {
    target_post_id: postId,
  });

  if (deleteError) {
    console.error("Error deleting post:", {
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
      userId: user.id,
      postId,
      postUserId: post.user_id,
    });

    return {
      success: false,
      error: getUserSafeErrorMessage(deleteError, "Could not remove post."),
    };
  }

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);

  redirect("/");
}
