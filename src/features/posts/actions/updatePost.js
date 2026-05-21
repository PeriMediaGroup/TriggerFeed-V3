// src/features/posts/actions/updatePost.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePostInput } from "../utils/validatePost";

function getGifUrl(gif) {
  return (
    gif?.external_url ||
    gif?.url ||
    gif?.secure_url ||
    gif?.media_url ||
    gif?.image_url ||
    gif?.images?.original?.url ||
    gif?.images?.downsized_medium?.url ||
    gif?.images?.fixed_height?.url ||
    gif?.images?.preview_gif?.url ||
    ""
  );
}

function getGifThumbnailUrl(gif) {
  return (
    gif?.thumbnail_url ||
    gif?.preview_url ||
    gif?.previewUrl ||
    gif?.images?.fixed_width_small?.url ||
    gif?.images?.fixed_height_small?.url ||
    gif?.images?.preview_gif?.url ||
    getGifUrl(gif)
  );
}

function getGifExternalId(gif) {
  return gif?.external_id || gif?.public_id || gif?.publicId || gif?.id || "";
}

function getGifTitle(gif) {
  return gif?.title || gif?.name || "GIPHY";
}

function getGifSortOrder(gif) {
  const sortOrder = Number(gif?.sortOrder ?? gif?.displayOrder ?? 999);
  return Number.isFinite(sortOrder) ? sortOrder : 999;
}

async function getNextGifSortOrder({ supabase, postId, gif }) {
  const fallbackSortOrder = getGifSortOrder(gif);

  const { data, error } = await supabase
    .from("post_media")
    .select("sort_order, display_order, media_type")
    .eq("post_id", postId);

  if (error || !Array.isArray(data)) {
    if (error) {
      console.error("UPDATE POST GIF SORT ORDER ERROR:", {
        code: error.code,
        message: error.message,
      });
    }

    return fallbackSortOrder;
  }

  const nonGifMedia = data.filter((item) => {
    const mediaType = `${item?.media_type || ""}`.toLowerCase();
    return mediaType !== "gif" && mediaType !== "giphy";
  });

  if (nonGifMedia.length === 0) {
    return fallbackSortOrder;
  }

  const maxExistingOrder = Math.max(
    ...nonGifMedia.map((item) => {
      const order = Number(item?.display_order ?? item?.sort_order ?? 0);
      return Number.isFinite(order) ? order : 0;
    }),
  );

  return Math.max(fallbackSortOrder, maxExistingOrder + 1);
}

async function writeAuditLog(supabase, payload) {
  const { error } = await supabase.from("post_audit_logs").insert(payload);

  if (error) {
    console.error("POST AUDIT LOG ERROR:", {
      code: error.code,
      message: error.message,
      payload,
    });
  }
}

async function removePostGif({ supabase, postId }) {
  return supabase
    .from("post_media")
    .delete()
    .eq("post_id", postId)
    .in("media_type", ["gif", "giphy"]);
}

async function savePostGif({ supabase, postId, userId, gif }) {
  const gifUrl = getGifUrl(gif);

  if (!gifUrl) {
    return {
      success: false,
      message: "No valid GIF URL was provided.",
      errors: {
        gif: "No valid GIF URL was provided.",
      },
    };
  }

  const { error: deleteOldGifError } = await removePostGif({
    supabase,
    postId,
  });

  if (deleteOldGifError) {
    return {
      success: false,
      message: "Post updated, but the old GIF could not be removed.",
      errors: {
        gif: deleteOldGifError.message,
      },
    };
  }

  const sortOrder = await getNextGifSortOrder({
    supabase,
    postId,
    gif,
  });

  const gifRecord = {
    post_id: postId,
    user_id: userId,
    media_type: "gif",
    provider: "giphy",
    source: "giphy",
    external_id: getGifExternalId(gif),
    external_url: gifUrl,
    thumbnail_url: getGifThumbnailUrl(gif),
    title: getGifTitle(gif),
    sort_order: sortOrder,
    display_order: sortOrder,
  };

  const { error: insertGifError } = await supabase
    .from("post_media")
    .insert(gifRecord);

  if (insertGifError) {
    console.error("UPDATE POST GIF INSERT ERROR:", {
      code: insertGifError.code,
      message: insertGifError.message,
      details: insertGifError.details,
      hint: insertGifError.hint,
      attemptedInsert: gifRecord,
    });

    return {
      success: false,
      message: `Post updated, but the GIF could not be saved: ${insertGifError.message}`,
      errors: {
        gif: insertGifError.message,
      },
    };
  }

  return {
    success: true,
    errors: {},
  };
}

export async function updatePost(postId, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to edit a post.",
    };
  }

  const rawPost = {
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  };

  const validation = validatePostInput(rawPost);

  if (!validation.isValid) {
    await writeAuditLog(supabase, {
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: "validation_error",
      error_message: "Post validation failed.",
      metadata: {
        errors: validation.errors,
      },
    });

    return {
      success: false,
      message: "Please fix the post errors.",
      errors: validation.errors,
    };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      title: validation.values.title,
      body: validation.values.body,
      visibility: validation.values.visibility,
    })
    .eq("id", postId)
    .eq("user_id", user.id)
    .eq("is_deleted", false);

  if (error) {
    await writeAuditLog(supabase, {
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: error.code,
      error_message: error.message,
      metadata: {
        source: "updatePost",
      },
    });

    return {
      success: false,
      message: "Post could not be updated.",
    };
  }

  const gifValue = formData.get("gif");
  const shouldRemoveGif = formData.get("remove_gif") === "true";

  if (shouldRemoveGif) {
    const { error: deleteGifError } = await removePostGif({
      supabase,
      postId,
    });

    if (deleteGifError) {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: deleteGifError.code,
        error_message: deleteGifError.message,
        metadata: {
          source: "updatePost",
          step: "remove_gif",
        },
      });

      return {
        success: false,
        message: "Post updated, but the existing GIF could not be removed.",
        errors: {
          gif: deleteGifError.message,
        },
      };
    }
  }

  if (gifValue) {
    let gif = null;

    try {
      gif = JSON.parse(gifValue);
    } catch {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: "invalid_gif_json",
        error_message: "Invalid GIF data.",
        metadata: {
          source: "updatePost",
          step: "parse_gif",
        },
      });

      return {
        success: false,
        message: "Invalid GIF data.",
        errors: {
          gif: "Invalid GIF data.",
        },
      };
    }

    const gifResult = await savePostGif({
      supabase,
      postId,
      userId: user.id,
      gif,
    });

    if (!gifResult.success) {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: "gif_save_failed",
        error_message: gifResult.message,
        metadata: {
          source: "updatePost",
          step: "save_gif",
          errors: gifResult.errors,
        },
      });

      return gifResult;
    }
  }

  await writeAuditLog(supabase, {
    post_id: postId,
    user_id: user.id,
    event_type: "post_update_success",
    success: true,
    metadata: {
      source: "updatePost",
      updatedGif: Boolean(gifValue),
      removedGif: shouldRemoveGif,
    },
  });

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    errors: {},
  };
}
