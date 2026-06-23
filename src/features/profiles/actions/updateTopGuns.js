"use server";

import { revalidatePath } from "next/cache";

import { deleteCloudinaryImage } from "@/features/media/cloudinary";
import { createClient } from "@/lib/supabase/server";

const TOP_GUN_SELECT =
  "id,name,display_order,image_cloudinary_url,image_cloudinary_secure_url,image_cloudinary_public_id,image_width,image_height";

export async function updateTopGuns(_prevState, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in.",
      errors: {},
    };
  }

  const gunNames = formData
    .getAll("top_gun_names")
    .map((name) => String(name || "").trim())
    .slice(0, 4);
  const gunIds = formData
    .getAll("top_gun_ids")
    .map((id) => String(id || "").trim())
    .slice(0, 4);

  if (gunNames.some((name) => name.length > 60)) {
    return {
      success: false,
      message: "Please fix the fields below.",
      errors: {
        top_guns: "Each top gun name must be 60 characters or less.",
      },
    };
  }

  const { data: existingGuns, error: existingError } = await supabase
    .from("profile_top_guns")
    .select(TOP_GUN_SELECT)
    .eq("user_id", user.id);

  if (existingError) {
    console.error("GET CURRENT TOP GUNS ERROR:", existingError);
    return {
      success: false,
      message: "Could not update top guns.",
      errors: {},
    };
  }

  const existingById = new Map(
    (existingGuns || []).map((gun) => [gun.id, gun]),
  );
  const submittedGuns = gunNames
    .map((name, index) => ({ id: gunIds[index], name }))
    .filter((gun) => gun.name);
  const rowsToInsert = submittedGuns
    .map((gun, index) => {
      const existing = existingById.get(gun.id);

      return {
        ...(existing ? { id: existing.id } : {}),
        user_id: user.id,
        name: gun.name,
        display_order: index,
        image_cloudinary_url: existing?.image_cloudinary_url || null,
        image_cloudinary_secure_url:
          existing?.image_cloudinary_secure_url || null,
        image_cloudinary_public_id:
          existing?.image_cloudinary_public_id || null,
        image_width: existing?.image_width || null,
        image_height: existing?.image_height || null,
        updated_at: new Date().toISOString(),
      };
    });

  const { error: deleteError } = await supabase
    .from("profile_top_guns")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("DELETE TOP GUNS ERROR:", deleteError);
    return {
      success: false,
      message: "Could not update top guns.",
      errors: {},
    };
  }

  let savedGuns = [];

  if (rowsToInsert.length > 0) {
    const { data, error: insertError } = await supabase
      .from("profile_top_guns")
      .insert(rowsToInsert)
      .select(TOP_GUN_SELECT);

    if (insertError) {
      console.error("INSERT TOP GUNS ERROR:", insertError);
      return {
        success: false,
        message: "Could not save top guns.",
        errors: {},
      };
    }

    savedGuns = data || [];
  }

  savedGuns.sort((left, right) => left.display_order - right.display_order);

  const savedIds = new Set(savedGuns.map((gun) => gun.id));
  const removedImagePublicIds = (existingGuns || [])
    .filter((gun) => !savedIds.has(gun.id) && gun.image_cloudinary_public_id)
    .map((gun) => gun.image_cloudinary_public_id);

  if (removedImagePublicIds.length > 0) {
    const cleanupResults = await Promise.allSettled(
      removedImagePublicIds.map((publicId) => deleteCloudinaryImage(publicId)),
    );
    const cleanupFailures = cleanupResults.filter(
      (result) => result.status === "rejected",
    );

    if (cleanupFailures.length > 0) {
      console.error("DELETE REMOVED TOP GUN IMAGES ERROR:", cleanupFailures);
    }
  }

  revalidatePath("/profile");
  revalidatePath("/profile/guns");
  revalidatePath(`/profiles/${user.id}`);

  return {
    success: true,
    message: "Top guns saved.",
    errors: {},
    topGuns: savedGuns,
  };
}
