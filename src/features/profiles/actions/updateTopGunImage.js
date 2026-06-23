"use server";

import { revalidatePath } from "next/cache";

import {
  deleteCloudinaryImage,
  uploadGunImage,
} from "@/features/media/cloudinary";
import { createClient } from "@/lib/supabase/server";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";

function hasRealFile(file) {
  return file instanceof File && file.size > 0 && file.name;
}

function revalidateGunProfiles(userId) {
  revalidatePath("/profile");
  revalidatePath("/profile/guns");
  revalidatePath(`/profiles/${userId}`);
}

export async function updateTopGunImage(formData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: "You must be logged in." };
  }

  const gunId = String(formData.get("gun_id") || "").trim();
  const imageFile = formData.get("image");

  if (!gunId || !hasRealFile(imageFile)) {
    return { success: false, message: "Choose an image to upload." };
  }

  const { data: gun, error: gunError } = await supabase
    .from("profile_top_guns")
    .select("id,image_cloudinary_public_id")
    .eq("id", gunId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gunError || !gun) {
    return { success: false, message: "Top gun not found." };
  }

  let uploaded;

  try {
    uploaded = await uploadGunImage({
      file: imageFile,
      userId: user.id,
      gunId,
    });
  } catch (error) {
    console.error("TOP GUN IMAGE UPLOAD ERROR:", error);
    return {
      success: false,
      message: getUserSafeErrorMessage(error, "Could not upload top gun image."),
    };
  }

  const { data: updatedGun, error: updateError } = await supabase
    .from("profile_top_guns")
    .update({
      image_cloudinary_url: uploaded.url,
      image_cloudinary_secure_url: uploaded.secureUrl,
      image_cloudinary_public_id: uploaded.publicId,
      image_width: uploaded.width,
      image_height: uploaded.height,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gunId)
    .eq("user_id", user.id)
    .select(
      "id,name,display_order,image_cloudinary_url,image_cloudinary_secure_url,image_cloudinary_public_id,image_width,image_height",
    )
    .single();

  if (updateError) {
    console.error("UPDATE TOP GUN IMAGE ERROR:", updateError);
    return { success: false, message: "Could not save top gun image." };
  }

  revalidateGunProfiles(user.id);

  return {
    success: true,
    message: gun.image_cloudinary_public_id
      ? "Top gun image changed."
      : "Top gun image uploaded.",
    gun: updatedGun,
  };
}

export async function removeTopGunImage(gunId) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: "You must be logged in." };
  }

  const cleanGunId = String(gunId || "").trim();
  const { data: gun, error: gunError } = await supabase
    .from("profile_top_guns")
    .select("id,image_cloudinary_public_id")
    .eq("id", cleanGunId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (gunError || !gun) {
    return { success: false, message: "Top gun not found." };
  }

  if (gun.image_cloudinary_public_id) {
    try {
      await deleteCloudinaryImage(gun.image_cloudinary_public_id);
    } catch (error) {
      console.error("REMOVE TOP GUN CLOUDINARY IMAGE ERROR:", error);
      return { success: false, message: "Could not remove top gun image." };
    }
  }

  const { data: updatedGun, error: updateError } = await supabase
    .from("profile_top_guns")
    .update({
      image_cloudinary_url: null,
      image_cloudinary_secure_url: null,
      image_cloudinary_public_id: null,
      image_width: null,
      image_height: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleanGunId)
    .eq("user_id", user.id)
    .select(
      "id,name,display_order,image_cloudinary_url,image_cloudinary_secure_url,image_cloudinary_public_id,image_width,image_height",
    )
    .single();

  if (updateError) {
    console.error("CLEAR TOP GUN IMAGE ERROR:", updateError);
    return { success: false, message: "Could not remove top gun image." };
  }

  revalidateGunProfiles(user.id);

  return {
    success: true,
    message: "Top gun image removed.",
    gun: updatedGun,
  };
}
