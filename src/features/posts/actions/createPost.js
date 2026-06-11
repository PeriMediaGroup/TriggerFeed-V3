"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserModerationBlock } from "@/features/admin/moderationStatus";
import { createMentionNotifications } from "@/features/mentions/actions/createMentionNotifications";
import {
  getFirstPostError,
  validatePostInput,
} from "../utils/validatePost";

function isTrustedGiphyMediaUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "media.giphy.com" ||
        /^media\d+\.giphy\.com$/.test(url.hostname) ||
        url.hostname === "i.giphy.com"
      )
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
      (
        url.hostname === "giphy.com" ||
        url.hostname === "www.giphy.com"
      )
    );
  } catch {
    return false;
  }
}

export async function createPost(formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to create a post.",
    };
  }

  const moderationBlock = await getCurrentUserModerationBlock(supabase);

  if (moderationBlock.blocked) {
    return {
      success: false,
      message: moderationBlock.message,
    };
  }

  const rawPost = {
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  };
  const wantsSticky = formData.get("is_sticky") === "true";

  const { data: authStatus, error: authStatusError } = await supabase
    .rpc("get_my_profile_auth_status")
    .single();

  if (authStatusError) {
    console.error("CREATE POST AUTH STATUS ERROR:", {
      code: authStatusError.code,
      message: authStatusError.message,
      details: authStatusError.details,
      hint: authStatusError.hint,
    });
  }

  const isCeo = authStatus?.role === "ceo";
  const isSticky = isCeo && wantsSticky;

  const validation = validatePostInput(rawPost);

  if (!validation.isValid) {
    await supabase.from("post_audit_logs").insert({
      user_id: user.id,
      event_type: "post_create_failed",
      success: false,
      error_code: "validation_error",
      error_message: "Post validation failed.",
      metadata: {
        errors: validation.errors,
      },
    });

    return {
      success: false,
      message: getFirstPostError(validation.errors),
      errors: validation.errors,
    };
  }

  // -----------------------------
  // Poll parsing + validation
  // -----------------------------
  const rawPoll = formData.get("poll");
  let poll = null;

  if (rawPoll) {
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

  if (poll) {
    const question = poll.question?.trim() || "";

    const options = Array.isArray(poll.options)
      ? poll.options.map((option) => option.trim()).filter(Boolean)
      : [];

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

    poll = {
      question,
      options,
      allowsMultiple: false,
    };
  }

  // -----------------------------
  // GIF parsing + validation
  // -----------------------------
  const rawGif = formData.get("gif");
  let gif = null;

  if (rawGif) {
    try {
      gif = JSON.parse(rawGif);
    } catch {
      return {
        success: false,
        message: "Invalid GIF data.",
        errors: {
          gif: "Invalid GIF data.",
        },
      };
    }
  }

  if (gif) {
    const gifUrl = gif.url?.trim();
    const gifId = gif.id?.trim();
    const previewUrl = gif.previewUrl?.trim() || gifUrl;
    const giphyUrl = gif.giphyUrl?.trim() || null;
    const sourcePostUrl = gif.sourcePostUrl?.trim() || null;

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
      !isTrustedGiphyMediaUrl(previewUrl) ||
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

    const sortOrder = Number.isInteger(gif.sortOrder)
      ? gif.sortOrder
      : Number.parseInt(gif.sortOrder, 10);

    const displayOrder = Number.isInteger(gif.displayOrder)
      ? gif.displayOrder
      : Number.parseInt(gif.displayOrder, 10);

    gif = {
      id: gifId,
      title: gif.title?.trim() || null,
      url: gifUrl,
      previewUrl,
      giphyUrl,
      username: gif.username?.trim() || null,
      sourcePostUrl,
      source: "giphy",
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
    };
  }

  const rpcGif = gif
    ? {
        external_id: gif.id,
        external_url: gif.url,
        thumbnail_url: gif.previewUrl,
        title: gif.title,
        sort_order: gif.sortOrder,
        display_order: gif.displayOrder,
      }
    : null;

  const rpcPoll = poll
    ? {
        question: poll.question,
        options: poll.options,
        allows_multiple: poll.allowsMultiple,
      }
    : null;

  const { data: postId, error: postError } = await supabase.rpc(
    "create_post_transactional",
    {
      p_title: validation.values.title,
      p_body: validation.values.body,
      p_visibility: validation.values.visibility,
      p_is_sticky: isSticky,
      p_gif: rpcGif,
      p_poll: rpcPoll,
    },
  );

  if (postError) {
    console.error("CREATE POST TRANSACTION ERROR:", {
      code: postError.code,
      message: postError.message,
      details: postError.details,
      hint: postError.hint,
    });

    const { error: auditError } = await supabase.from("post_audit_logs").insert({
      user_id: user.id,
      event_type: "post_create_failed",
      success: false,
      error_code: postError.code,
      error_message: postError.message,
      metadata: {
        source: "createPost",
        details: postError.details,
        hint: postError.hint,
      },
    });

    if (auditError) {
      console.error("POST AUDIT LOG ERROR:", {
        code: auditError.code,
        message: auditError.message,
        details: auditError.details,
        hint: auditError.hint,
      });
    }

    return {
      success: false,
      message: "Post could not be created.",
    };
  }

  // -----------------------------
  // Audit success
  // -----------------------------
  await supabase.from("post_audit_logs").insert({
    post_id: postId,
    user_id: user.id,
    event_type: "post_create_success",
    success: true,
    metadata: {
      source: "createPost",
      has_poll: Boolean(poll),
      has_gif: Boolean(gif),
    },
  });

  // -----------------------------
  // Mentions
  // -----------------------------
  const mentionText = `${validation.values.title || ""} ${validation.values.body || ""
    }`;

  const mentionResult = await createMentionNotifications({
    text: mentionText,
    actorId: user.id,
    postId,
  });

  if (!mentionResult.success) {
    console.error("CREATE POST MENTION NOTIFICATION ERROR:", mentionResult.error);
  }

  revalidatePath("/");
  revalidatePath("/");

  return {
    success: true,
    postId,
    errors: {},
  };
}
