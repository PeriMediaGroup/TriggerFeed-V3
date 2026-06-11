"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserModerationBlock } from "@/features/admin/moderationStatus";
import { getPostMediaFolder } from "@/features/media/mediaPaths";
import { POST_MEDIA_LIMITS } from "@/features/media/mediaConstants";

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

  const expectedFolder = getPostMediaFolder({
    userId: user.id,
    postId,
  });

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

  function isTrustedCloudinaryUrl(value) {
    try {
      const url = new URL(value);

      return (
        url.protocol === "https:" &&
        url.hostname === "res.cloudinary.com" &&
        url.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/`)
      );
    } catch {
      return false;
    }
  }

  const cleanedMedia = media
    .filter((item) => {
      const publicId = item?.cloudinary_public_id || "";
      const cloudinaryUrl = item?.cloudinary_url || "";
      const secureUrl = item?.cloudinary_secure_url || cloudinaryUrl;
      return (
        item &&
        item.provider === "cloudinary" &&
        ["image", "video"].includes(item.media_type) &&
        item.cloudinary_url &&
        item.cloudinary_public_id &&
        publicId.startsWith(`${expectedFolder}/`) &&
        isTrustedCloudinaryUrl(item.cloudinary_url) &&
        isTrustedCloudinaryUrl(secureUrl)
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

  if (!media.length) {
    return {
      success: true,
      errors: [],
      media: [],
    };
  }

  if (!cleanedMedia.length) {
    return {
      success: false,
      errors: ["No valid media records were provided."],
      media: [],
    };
  }

  const moderationBlock = await getCurrentUserModerationBlock(supabase);

  if (moderationBlock.blocked) {
    return {
      success: false,
      errors: [moderationBlock.message],
      media: [],
    };
  }

  const { data: existingMedia, error: existingMediaError } = await supabase
    .from("post_media")
    .select("id, media_type")
    .eq("post_id", postId);

  if (existingMediaError) {
    return {
      success: false,
      errors: ["Could not check existing post media."],
      media: [],
    };
  }

  const existingMediaRows = Array.isArray(existingMedia) ? existingMedia : [];
  const existingVideoCount = existingMediaRows.filter((item) => {
    return `${item.media_type || ""}`.toLowerCase() === "video";
  }).length;
  const nextVideoCount =
    existingVideoCount +
    cleanedMedia.filter((item) => item.media_type === "video").length;
  const nextTotalCount = existingMediaRows.length + cleanedMedia.length;

  if (nextTotalCount > POST_MEDIA_LIMITS.maxTotalFiles) {
    return {
      success: false,
      errors: [
        `You can add up to ${POST_MEDIA_LIMITS.maxTotalFiles} total media items per post.`,
      ],
      media: [],
    };
  }

  if (nextVideoCount > POST_MEDIA_LIMITS.maxVideoFiles) {
    return {
      success: false,
      errors: ["You can add 1 video per post for now."],
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
