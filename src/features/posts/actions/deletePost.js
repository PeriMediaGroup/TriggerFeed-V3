"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function deletePost(postId) {
  if (!postId) {
    return {
      success: false,
      error: "Missing post id",
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: "You must be logged in to delete a post.",
    };
  }

  const supabase = await createClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post) {
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

  const { error: deleteError } = await supabase
    .from("posts")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (deleteError) {
    return {
      success: false,
      error: deleteError.message,
    };
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  redirect("/");
}
