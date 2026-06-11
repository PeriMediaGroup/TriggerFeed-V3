// src/features/posts/actions/updatePost.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePostInput } from "../utils/validatePost";

function isTrustedGiphyMediaUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (url.hostname === "media.giphy.com" ||
        /^media\d+\.giphy\.com$/.test(url.hostname) ||
        url.hostname === "i.giphy.com")
    );
  } catch {
    return false;
  }
}

function isTrustedGiphyPageUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (url.hostname === "giphy.com" || url.hostname === "www.giphy.com")
    );
  } catch {
    return false;
  }
}

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
    gif?.previewUrl ||
    gif?.preview_url ||
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
  return gif?.title?.trim() || gif?.name?.trim() || "GIPHY";
}

function getGifSortOrder(gif) {
  const sortOrder = Number(gif?.sortOrder ?? gif?.displayOrder ?? 999);
  return Number.isFinite(sortOrder) ? sortOrder : 999;
}

function normalizePollDraft(rawPoll) {
  if (!rawPoll) {
    return null;
  }

  let poll = rawPoll;

  if (typeof rawPoll === "string") {
    try {
      poll = JSON.parse(rawPoll);
    } catch {
      return {
        success: false,
        message: "Invalid poll data.",
        errors: {
          poll: "Invalid poll data.",
        },
      };
    }
  }

  const question = poll?.question?.trim() || "";

  const options = Array.isArray(poll?.options)
    ? poll.options
        .map((option) => {
          if (typeof option === "string") {
            return option.trim();
          }

          return (
            option?.option_text ||
            option?.text ||
            option?.label ||
            option?.value ||
            ""
          ).trim();
        })
        .filter(Boolean)
    : [];

  if (!question && options.length === 0) {
    return null;
  }

  if (!question || options.length < 2) {
    return {
      success: false,
      message: "Polls need a question and at least two options.",
      errors: {
        poll: "Polls need a question and at least two options.",
      },
    };
  }

  if (question.length > 180) {
    return {
      success: false,
      message: "Poll question must be 180 characters or less.",
      errors: {
        poll: "Poll question must be 180 characters or less.",
      },
    };
  }

  if (options.some((option) => option.length > 120)) {
    return {
      success: false,
      message: "Poll options must be 120 characters or less.",
      errors: {
        poll: "Poll options must be 120 characters or less.",
      },
    };
  }

  return {
    success: true,
    poll: {
      question,
      options,
      allowsMultiple: false,
    },
  };
}

function validateGif(gif) {
  const gifUrl = getGifUrl(gif);
  const gifId = getGifExternalId(gif);
  const thumbnailUrl = getGifThumbnailUrl(gif);
  const giphyUrl = gif?.giphyUrl || gif?.giphy_url || null;

  if (!gifUrl || !gifId) {
    return {
      success: false,
      message: "Invalid GIF data.",
      errors: {
        gif: "Invalid GIF data.",
      },
    };
  }

  if (
    !isTrustedGiphyMediaUrl(gifUrl) ||
    !isTrustedGiphyMediaUrl(thumbnailUrl) ||
    !isTrustedGiphyPageUrl(giphyUrl)
  ) {
    return {
      success: false,
      message: "Invalid GIPHY media URL.",
      errors: {
        gif: "Invalid GIPHY media URL.",
      },
    };
  }

  return {
    success: true,
    gifUrl,
    thumbnailUrl,
    gifId,
  };
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
  const wantsSticky = formData.get("is_sticky") === "true";
  const validation = validatePostInput(rawPost);

  const { data: authStatus, error: authStatusError } = await supabase
    .rpc("get_my_profile_auth_status")
    .single();

  if (authStatusError) {
    console.error("UPDATE POST AUTH STATUS ERROR:", {
      code: authStatusError.code,
      message: authStatusError.message,
      details: authStatusError.details,
      hint: authStatusError.hint,
    });
  }

  const isCeo = authStatus?.role === "ceo";
  const isSticky = isCeo ? wantsSticky : false;

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

  const rawPoll = formData.get("poll");
  const shouldRemovePoll = formData.get("remove_poll") === "true";
  const pollValidation = normalizePollDraft(rawPoll);

  if (pollValidation?.success === false) {
    await writeAuditLog(supabase, {
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: "invalid_poll",
      error_message: pollValidation.message,
      metadata: {
        source: "updatePost",
        step: "validate_poll",
        errors: pollValidation.errors,
      },
    });

    return pollValidation;
  }

  const gifValue = formData.get("gif");
  const shouldRemoveGif = formData.get("remove_gif") === "true";
  let rpcGif = null;

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

    const gifValidation = validateGif(gif);

    if (!gifValidation.success) {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: "invalid_gif",
        error_message: gifValidation.message,
        metadata: {
          source: "updatePost",
          step: "validate_gif",
          errors: gifValidation.errors,
        },
      });

      return gifValidation;
    }

    const sortOrder = getGifSortOrder(gif);

    rpcGif = {
      external_id: gifValidation.gifId,
      external_url: gifValidation.gifUrl,
      thumbnail_url: gifValidation.thumbnailUrl,
      title: getGifTitle(gif),
      sort_order: sortOrder,
      display_order: sortOrder,
    };
  }

  const rpcPoll = pollValidation?.poll
    ? {
        question: pollValidation.poll.question,
        options: pollValidation.poll.options,
        allows_multiple: pollValidation.poll.allowsMultiple,
      }
    : null;

  const { error } = await supabase.rpc("update_post_transactional", {
    p_post_id: postId,
    p_title: validation.values.title,
    p_body: validation.values.body,
    p_visibility: validation.values.visibility,
    p_is_sticky: isSticky,
    p_gif: rpcGif,
    p_remove_gif: shouldRemoveGif,
    p_poll: rpcPoll,
    p_remove_poll: shouldRemovePoll,
  });

  if (error) {
    await writeAuditLog(supabase, {
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: error?.code || "transaction_failed",
      error_message: error?.message || "Post was not found or you cannot edit it.",
      metadata: {
        source: "updatePost",
        step: "update_post_transactional",
      },
    });

    if (error.message?.includes("poll")) {
      return {
        success: false,
        message: error.message,
        errors: {
          poll: error.message,
        },
      };
    }

    return {
      success: false,
      message: error.message || "Post could not be updated.",
      errors: {},
    };
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
      updatedPoll: Boolean(pollValidation?.poll),
      removedPoll: shouldRemovePoll,
    },
  });

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    errors: {},
  };
}
