import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@/lib/supabase/server";
import { getPostMediaFolder } from "@/features/media/mediaPaths";

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

  const body = await request.json();
  const postId = body?.postId;
  const mediaType = body?.mediaType;

  if (!postId || !["image", "video"].includes(mediaType)) {
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 400 },
    );
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

  const timestamp = Math.round(Date.now() / 1000);
  const folder = getPostMediaFolder({
    userId: user.id,
    postId,
  });

  const resourceType = mediaType === "video" ? "video" : "image";

  const paramsToSign = {
    timestamp,
    folder,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET,
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    resourceType,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
}