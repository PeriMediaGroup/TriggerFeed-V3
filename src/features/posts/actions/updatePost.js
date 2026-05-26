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

function normalizeOptionList(options) {
  return (options || []).map((option) => `${option || ""}`.trim());
}

function arePollOptionsUnchanged(existingOptions, nextOptions) {
  const existing = normalizeOptionList(
    existingOptions.map((option) => option.option_text),
  );
  const next = normalizeOptionList(nextOptions);

  if (existing.length !== next.length) {
    return false;
  }

  return existing.every((option, index) => option === next[index]);
}

function isSameGif(existingGif, nextGif) {
  if (!existingGif || !nextGif) {
    return false;
  }

  const existingId = getGifExternalId(existingGif);
  const nextId = getGifExternalId(nextGif);

  if (existingId && nextId) {
    return existingId === nextId;
  }

  return getGifUrl(existingGif) === getGifUrl(nextGif);
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

async function getExistingGif({ supabase, postId }) {
  const { data, error } = await supabase
    .from("post_media")
    .select(
      "id, external_id, external_url, thumbnail_url, title, sort_order, display_order, media_type, provider, source",
    )
    .eq("post_id", postId)
    .in("media_type", ["gif", "giphy"])
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      success: false,
      error,
      gifs: [],
    };
  }

  return {
    success: true,
    gifs: Array.isArray(data) ? data : [],
  };
}

async function removePostGif({ supabase, postId }) {
  return supabase
    .from("post_media")
    .delete()
    .eq("post_id", postId)
    .in("media_type", ["gif", "giphy"]);
}

async function savePostGif({ supabase, postId, userId, gif }) {
  const validation = validateGif(gif);

  if (!validation.success) {
    return validation;
  }

  const { gifUrl, thumbnailUrl, gifId } = validation;

  const existingGifResult = await getExistingGif({
    supabase,
    postId,
  });

  if (!existingGifResult.success) {
    return {
      success: false,
      message: "Post updated, but the existing GIF could not be checked.",
      errors: {
        gif: existingGifResult.error.message,
      },
    };
  }

  const existingGifs = existingGifResult.gifs;
  const primaryExistingGif = existingGifs[0] || null;

  if (primaryExistingGif && isSameGif(primaryExistingGif, gif)) {
    return {
      success: true,
      errors: {},
      unchanged: true,
    };
  }

  const sortOrder = primaryExistingGif
    ? Number(primaryExistingGif.display_order ?? primaryExistingGif.sort_order ?? getGifSortOrder(gif))
    : await getNextGifSortOrder({
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
    external_id: gifId,
    external_url: gifUrl,
    thumbnail_url: thumbnailUrl,
    title: getGifTitle(gif),
    sort_order: sortOrder,
    display_order: sortOrder,
  };

  if (primaryExistingGif) {
    const { error: updateGifError } = await supabase
      .from("post_media")
      .update(gifRecord)
      .eq("id", primaryExistingGif.id)
      .eq("post_id", postId);

    if (updateGifError) {
      console.error("UPDATE POST GIF UPDATE ERROR:", {
        code: updateGifError.code,
        message: updateGifError.message,
        details: updateGifError.details,
        hint: updateGifError.hint,
        attemptedUpdate: gifRecord,
      });

      return {
        success: false,
        message: `Post updated, but the GIF could not be saved: ${updateGifError.message}`,
        errors: {
          gif: updateGifError.message,
        },
      };
    }

    const duplicateGifIds = existingGifs
      .slice(1)
      .map((existingGif) => existingGif.id)
      .filter(Boolean);

    if (duplicateGifIds.length > 0) {
      const { error: deleteDuplicateGifError } = await supabase
        .from("post_media")
        .delete()
        .eq("post_id", postId)
        .in("id", duplicateGifIds);

      if (deleteDuplicateGifError) {
        console.error("UPDATE POST DUPLICATE GIF DELETE ERROR:", {
          code: deleteDuplicateGifError.code,
          message: deleteDuplicateGifError.message,
          details: deleteDuplicateGifError.details,
          hint: deleteDuplicateGifError.hint,
        });
      }
    }

    return {
      success: true,
      errors: {},
    };
  }

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

async function getExistingPoll({ supabase, postId }) {
  const { data: poll, error } = await supabase
    .from("polls")
    .select("id, question, allows_multiple, poll_options(id, option_text, display_order)")
    .eq("post_id", postId)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error,
      poll: null,
    };
  }

  if (!poll) {
    return {
      success: true,
      poll: null,
    };
  }

  const options = Array.isArray(poll.poll_options)
    ? [...poll.poll_options].sort((left, right) => {
        return (left.display_order ?? 0) - (right.display_order ?? 0);
      })
    : [];

  return {
    success: true,
    poll: {
      ...poll,
      poll_options: options,
    },
  };
}

async function getPollResponseCount({ supabase, pollId }) {
  const { count, error } = await supabase
    .from("poll_responses")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("poll_id", pollId);

  if (error) {
    return {
      success: false,
      error,
      count: 0,
    };
  }

  return {
    success: true,
    count: count || 0,
  };
}

async function removePostPoll({ supabase, postId }) {
  const existingPollResult = await getExistingPoll({
    supabase,
    postId,
  });

  if (!existingPollResult.success) {
    return {
      success: false,
      message: "Post updated, but the existing poll could not be checked.",
      errors: {
        poll: existingPollResult.error.message,
      },
    };
  }

  const existingPoll = existingPollResult.poll;

  if (!existingPoll) {
    return {
      success: true,
      errors: {},
    };
  }

  const responseCountResult = await getPollResponseCount({
    supabase,
    pollId: existingPoll.id,
  });

  if (!responseCountResult.success) {
    return {
      success: false,
      message: "Post updated, but poll responses could not be checked.",
      errors: {
        poll: responseCountResult.error.message,
      },
    };
  }

  if (responseCountResult.count > 0) {
    return {
      success: false,
      message: "This poll already has votes, so it cannot be removed.",
      errors: {
        poll: "This poll already has votes, so it cannot be removed.",
      },
    };
  }

  const { error: optionsDeleteError } = await supabase
    .from("poll_options")
    .delete()
    .eq("poll_id", existingPoll.id);

  if (optionsDeleteError) {
    return {
      success: false,
      message: "Post updated, but poll options could not be removed.",
      errors: {
        poll: optionsDeleteError.message,
      },
    };
  }

  const { error: pollDeleteError } = await supabase
    .from("polls")
    .delete()
    .eq("id", existingPoll.id)
    .eq("post_id", postId);

  if (pollDeleteError) {
    return {
      success: false,
      message: "Post updated, but the poll could not be removed.",
      errors: {
        poll: pollDeleteError.message,
      },
    };
  }

  return {
    success: true,
    errors: {},
  };
}

async function savePostPoll({ supabase, postId, poll }) {
  const existingPollResult = await getExistingPoll({
    supabase,
    postId,
  });

  if (!existingPollResult.success) {
    return {
      success: false,
      message: "Post updated, but the existing poll could not be checked.",
      errors: {
        poll: existingPollResult.error.message,
      },
    };
  }

  const existingPoll = existingPollResult.poll;

  if (!existingPoll) {
    const { data: createdPoll, error: createPollError } = await supabase
      .from("polls")
      .insert({
        post_id: postId,
        question: poll.question,
        allows_multiple: poll.allowsMultiple,
      })
      .select("id")
      .single();

    if (createPollError) {
      return {
        success: false,
        message: `Post updated, but the poll could not be saved: ${createPollError.message}`,
        errors: {
          poll: createPollError.message,
        },
      };
    }

    const pollOptions = poll.options.map((optionText, index) => ({
      poll_id: createdPoll.id,
      option_text: optionText,
      display_order: index,
    }));

    const { error: createOptionsError } = await supabase
      .from("poll_options")
      .insert(pollOptions);

    if (createOptionsError) {
      return {
        success: false,
        message: `Post updated, but poll options could not be saved: ${createOptionsError.message}`,
        errors: {
          poll: createOptionsError.message,
        },
      };
    }

    return {
      success: true,
      errors: {},
    };
  }

  const responseCountResult = await getPollResponseCount({
    supabase,
    pollId: existingPoll.id,
  });

  if (!responseCountResult.success) {
    return {
      success: false,
      message: "Post updated, but poll responses could not be checked.",
      errors: {
        poll: responseCountResult.error.message,
      },
    };
  }

  const hasVotes = responseCountResult.count > 0;
  const existingOptions = existingPoll.poll_options || [];
  const optionsUnchanged = arePollOptionsUnchanged(existingOptions, poll.options);

  if (hasVotes && !optionsUnchanged) {
    return {
      success: false,
      message: "This poll already has votes, so its options cannot be changed.",
      errors: {
        poll: "This poll already has votes, so its options cannot be changed.",
      },
    };
  }

  const { error: updatePollError } = await supabase
    .from("polls")
    .update({
      question: poll.question,
      allows_multiple: poll.allowsMultiple,
    })
    .eq("id", existingPoll.id)
    .eq("post_id", postId);

  if (updatePollError) {
    return {
      success: false,
      message: `Post updated, but the poll could not be saved: ${updatePollError.message}`,
      errors: {
        poll: updatePollError.message,
      },
    };
  }

  if (hasVotes) {
    return {
      success: true,
      errors: {},
    };
  }

  const { error: deleteOptionsError } = await supabase
    .from("poll_options")
    .delete()
    .eq("poll_id", existingPoll.id);

  if (deleteOptionsError) {
    return {
      success: false,
      message: `Post updated, but old poll options could not be removed: ${deleteOptionsError.message}`,
      errors: {
        poll: deleteOptionsError.message,
      },
    };
  }

  const pollOptions = poll.options.map((optionText, index) => ({
    poll_id: existingPoll.id,
    option_text: optionText,
    display_order: index,
  }));

  const { error: createOptionsError } = await supabase
    .from("poll_options")
    .insert(pollOptions);

  if (createOptionsError) {
    return {
      success: false,
      message: `Post updated, but poll options could not be saved: ${createOptionsError.message}`,
      errors: {
        poll: createOptionsError.message,
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

  const { data: updatedPost, error } = await supabase
    .from("posts")
    .update({
      title: validation.values.title,
      body: validation.values.body,
      visibility: validation.values.visibility,
    })
    .eq("id", postId)
    .eq("user_id", user.id)
    .eq("is_deleted", false)
    .select("id")
    .maybeSingle();

  if (error || !updatedPost) {
    await writeAuditLog(supabase, {
      post_id: postId,
      user_id: user.id,
      event_type: "post_update_failed",
      success: false,
      error_code: error?.code || "not_found_or_forbidden",
      error_message: error?.message || "Post was not found or you cannot edit it.",
      metadata: {
        source: "updatePost",
      },
    });

    return {
      success: false,
      message: "Post could not be updated.",
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

  if (shouldRemovePoll) {
    const removePollResult = await removePostPoll({
      supabase,
      postId,
    });

    if (!removePollResult.success) {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: "poll_remove_failed",
        error_message: removePollResult.message,
        metadata: {
          source: "updatePost",
          step: "remove_poll",
          errors: removePollResult.errors,
        },
      });

      return removePollResult;
    }
  }

  if (pollValidation?.poll) {
    const savePollResult = await savePostPoll({
      supabase,
      postId,
      poll: pollValidation.poll,
    });

    if (!savePollResult.success) {
      await writeAuditLog(supabase, {
        post_id: postId,
        user_id: user.id,
        event_type: "post_update_failed",
        success: false,
        error_code: "poll_save_failed",
        error_message: savePollResult.message,
        metadata: {
          source: "updatePost",
          step: "save_poll",
          errors: savePollResult.errors,
        },
      });

      return savePollResult;
    }
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
