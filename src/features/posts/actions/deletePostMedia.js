"use server";

import { createClient } from "@/lib/supabase/server";
import { deleteCloudinaryImage } from "@/features/media/cloudinary";

export async function deletePostMedia({ postId, mediaIds }) {
  if (!postId || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    return {
      success: true,
      errors: [],
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
      errors: ["You must be logged in to remove media."],
    };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id")
    .eq("id", postId)
    .eq("user_id", user.id)
    .single();

  if (postError || !post) {
    return {
      success: false,
      errors: ["Post not found or you do not have permission."],
    };
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("post_media")
    .select("id, cloudinary_public_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .in("id", mediaIds);

  if (mediaError) {
    return {
      success: false,
      errors: [mediaError.message],
    };
  }

  if (!mediaRows?.length) {
    return {
      success: true,
      errors: [],
    };
  }

  const { error: deleteRowsError } = await supabase
    .from("post_media")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .in(
      "id",
      mediaRows.map((row) => row.id),
    );

  if (deleteRowsError) {
    return {
      success: false,
      errors: [deleteRowsError.message],
    };
  }

  await Promise.allSettled(
    mediaRows.map((row) => deleteCloudinaryImage(row.cloudinary_public_id)),
  );

  return {
    success: true,
    errors: [],
  };
}