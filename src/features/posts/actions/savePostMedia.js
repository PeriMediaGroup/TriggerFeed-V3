"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePostMedia({ postId, media }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      errors: ["You must be logged in to save media."],
      media: [],
    };
  }

  if (!postId || !Array.isArray(media)) {
    return {
      success: false,
      errors: ["Invalid media payload."],
      media: [],
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
      errors: ["Post not found or you do not have permission to save media."],
      media: [],
    };
  }

  const cleanedMedia = media
    .filter((item) => {
      return (
        item &&
        item.provider === "cloudinary" &&
        ["image", "video"].includes(item.media_type) &&
        item.cloudinary_url &&
        item.cloudinary_public_id
      );
    })
    .map((item, index) => ({
      post_id: postId,
      user_id: user.id,
      media_type: item.media_type,
      provider: "cloudinary",
      cloudinary_url: item.cloudinary_url,
      cloudinary_secure_url: item.cloudinary_secure_url || item.cloudinary_url,
      cloudinary_public_id: item.cloudinary_public_id,
      original_filename: item.original_filename || null,
      mime_type: item.mime_type || null,
      file_size_bytes: item.file_size_bytes || item.bytes || null,
      width: item.width || null,
      height: item.height || null,
      format: item.format || null,
      sort_order: item.sort_order ?? index,
      display_order: item.display_order ?? index,
    }));

  if (!cleanedMedia.length) {
    return {
      success: true,
      errors: [],
      media: [],
    };
  }

  const { data, error: insertError } = await supabase
    .from("post_media")
    .insert(cleanedMedia)
    .select("*");

  if (insertError) {
    console.error("SAVE POST MEDIA ERROR:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });

    return {
      success: false,
      errors: [insertError.message],
      media: [],
    };
  }

  return {
    success: true,
    errors: [],
    media: data || [],
  };
}