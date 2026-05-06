"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadImageToCloudinary } from "@/features/media/cloudinary";
import { getPostMediaFolder } from "@/features/media/mediaPaths";
import { validatePostImageFiles } from "@/features/media/mediaValidation";
import { uploadPostImage } from "@/features/media/cloudinary";

export async function uploadPostMedia({ postId, files }) {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return {
            success: false,
            errors: ["You must be logged in to upload media."],
            media: [],
        };
    }

    const validation = validatePostImageFiles(files);

    if (!validation.isValid) {
        return {
            success: false,
            errors: validation.errors,
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
            errors: ["Post not found or you do not have permission to add media."],
            media: [],
        };
    }

    const uploadedMedia = [];

    for (let index = 0; index < validation.files.length; index += 1) {
        const file = validation.files[index];

        const uploadResult = await uploadPostImage({
            file,
            folder: getPostMediaFolder({
                userId: user.id,
                postId,
            }),
        });

        uploadedMedia.push({
            post_id: postId,
            user_id: user.id,
            media_type: "image",
            provider: "cloudinary",
            cloudinary_url: uploadResult.url,
            cloudinary_secure_url: uploadResult.secureUrl,
            cloudinary_public_id: uploadResult.publicId,
            original_filename: file.name,
            mime_type: file.type,
            file_size_bytes: file.size,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            sort_order: index,
        });
    }

    if (uploadedMedia.length === 0) {
        return {
            success: true,
            errors: [],
            media: [],
        };
    }

    const { data, error: insertError } = await supabase
        .from("post_media")
        .insert(uploadedMedia)
        .select("*");

    if (insertError) {
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