import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserModerationBlock } from "@/features/admin/moderationStatus";
import { getPostMediaFolder } from "@/features/media/mediaPaths";
import { POST_MEDIA_LIMITS } from "@/features/media/mediaConstants";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "You must be logged in to upload media." },
      { status: 401 },
    );
  }

  const moderationBlock = await getCurrentUserModerationBlock(supabase);

  if (moderationBlock.blocked) {
    return NextResponse.json(
      { error: moderationBlock.message },
      { status: 403 },
    );
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      { error: "Cloudinary is not configured." },
      { status: 500 },
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid upload request body." },
      { status: 400 },
    );
  }

  const postId = body?.postId;
  const mediaType = body?.mediaType;
  const fileSize = Number(body?.fileSize);
  const mimeType = body?.mimeType;

  if (!postId || !["image", "video"].includes(mediaType)) {
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return NextResponse.json(
      { error: "Invalid file size." },
      { status: 400 },
    );
  }

  if (mediaType === "image") {
    if (!POST_MEDIA_LIMITS.allowedImageMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported image type." },
        { status: 400 },
      );
    }

    if (fileSize > POST_MEDIA_LIMITS.maxImageSizeBytes) {
      return NextResponse.json(
        { error: "Image file is too large." },
        { status: 400 },
      );
    }
  }

  if (mediaType === "video") {
    if (!POST_MEDIA_LIMITS.allowedVideoMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported video type." },
        { status: 400 },
      );
    }

    if (fileSize > POST_MEDIA_LIMITS.maxVideoSizeBytes) {
      return NextResponse.json(
        { error: "Video file is too large." },
        { status: 400 },
      );
    }
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id")
    .eq("id", postId)
    .eq("user_id", user.id)
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: "Post not found or you do not have permission to upload media." },
      { status: 403 },
    );
  }

  const uploadPreset =
    mediaType === "video"
      ? process.env.CLOUDINARY_POST_VIDEO_PRESET
      : process.env.CLOUDINARY_POST_IMAGE_PRESET;

  if (!uploadPreset) {
    return NextResponse.json(
      { error: "Cloudinary upload preset is not configured." },
      { status: 500 },
    );
  }

  const timestamp = Math.round(Date.now() / 1000);

  const folder = getPostMediaFolder({
    userId: user.id,
    postId,
  });

  const resourceType = mediaType === "video" ? "video" : "image";

  // Security note:
  // This route validates the client-reported file size and MIME type before
  // issuing a signature, but the browser could still upload a different file
  // after receiving the signature. Cloudinary signed upload presets must enforce
  // allowed formats and any available file-size restrictions.
  // Current required presets:
  // - triggerfeed_post_images
  // - triggerfeed_post_videos
  const uploadParams = {
    folder,
    overwrite: "false",
    timestamp,
    unique_filename: "true",
    upload_preset: uploadPreset,
    use_filename: "true",
  };

  const signature = cloudinary.utils.api_sign_request(
    uploadParams,
    process.env.CLOUDINARY_API_SECRET,
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    resourceType,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    overwrite: uploadParams.overwrite,
    uniqueFilename: uploadParams.unique_filename,
    uploadPreset: uploadParams.upload_preset,
    useFilename: uploadParams.use_filename,
  });
}
