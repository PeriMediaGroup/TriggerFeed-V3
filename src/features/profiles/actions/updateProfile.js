// src/features/profiles/actions/updateProfile.js

"use server";

import { uploadProfileImage } from "@/features/media/cloudinary";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function hasRealFile(file) {
  return file instanceof File && file.size > 0 && file.name;
}

export async function updateProfile(_prevState, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const avatarFile = formData.get("avatar");
  const bannerFile = formData.get("banner");

  const displayName = String(formData.get("display_name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const bio = String(formData.get("bio") || "").trim();

  const errors = {};

  if (!username) {
    errors.username = "Username is required.";
  }

  if (username && username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
  }

  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.username = "Username can only use letters, numbers, and underscores.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (bio.length > 500) {
    errors.bio = "Bio must be 500 characters or less.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      message: "Please fix the fields below.",
      errors,
    };
  }

  let avatarUpload = null;
  let bannerUpload = null;

  try {
    if (hasRealFile(avatarFile)) {
      avatarUpload = await uploadProfileImage({
        file: avatarFile,
        userId: user.id,
        imageType: "avatar",
      });
    }

    if (hasRealFile(bannerFile)) {
      bannerUpload = await uploadProfileImage({
        file: bannerFile,
        userId: user.id,
        imageType: "banner",
      });
    }
  } catch (uploadError) {
    console.error("PROFILE IMAGE UPLOAD ERROR:", uploadError);

    return {
      success: false,
      message: uploadError.message || "Could not upload profile image.",
      errors: {},
    };
  }

  const profileUpdates = {
    display_name: displayName || null,
    username,
    first_name: firstName || null,
    last_name: lastName || null,
    email: email || null,
    city: city || null,
    state: state || null,
    bio: bio || null,
    updated_at: new Date().toISOString(),
  };

  if (avatarUpload) {
    profileUpdates.avatar_cloudinary_url = avatarUpload.url;
    profileUpdates.avatar_cloudinary_public_id = avatarUpload.publicId;
  }

  if (bannerUpload) {
    profileUpdates.banner_cloudinary_url = bannerUpload.url;
    profileUpdates.banner_cloudinary_public_id = bannerUpload.publicId;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdates)
    .eq("id", user.id);

  if (updateError) {
    console.error("UPDATE PROFILE ERROR:", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      profileUpdates,
    });

    if (updateError.code === "23505") {
      return {
        success: false,
        message: "That username or email is already taken.",
        errors: {
          username: "That username or email is already taken.",
        },
      };
    }

    return {
      success: false,
      message: updateError.message || "Could not update profile.",
      errors: {},
    };
  }

  revalidatePath("/profile");
  revalidatePath(`/profiles/${user.id}`);

  return {
    success: true,
    message: "Saved",
    errors: {},
  };
}