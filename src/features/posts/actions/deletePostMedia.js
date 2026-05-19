"use server";

import { createClient } from "@/lib/supabase/server";
import { deleteCloudinaryMedia } from "@/features/media/cloudinary";

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
    .select("id, provider, media_type, cloudinary_public_id")
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

  const cloudinaryRows = mediaRows.filter((row) => {
    return row.provider === "cloudinary" && row.cloudinary_public_id;
  });

  const cloudinaryDeleteResults = await Promise.allSettled(
    cloudinaryRows.map((row) => {
      const resourceType = row.media_type === "video" ? "video" : "image";

      return deleteCloudinaryMedia(row.cloudinary_public_id, resourceType);
    }),
  );

  const failedCloudinaryDeletes = cloudinaryDeleteResults.filter((result) => {
    return result.status === "rejected";
  });

  if (failedCloudinaryDeletes.length > 0) {
    console.error("DELETE CLOUDINARY MEDIA ERROR:", failedCloudinaryDeletes);

    return {
      success: false,
      errors: [
        "Could not delete one or more Cloudinary assets. Media was not removed.",
      ],
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

  return {
    success: true,
    errors: [],
  };
}