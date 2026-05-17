"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createMentionNotifications } from "@/features/mentions/actions/createMentionNotifications";
import { validatePostInput } from "../utils/validatePost";

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

  const rawPost = {
    title: formData.get("title"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  };

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
      message: "Please fix the post errors.",
      errors: validation.errors,
    };
  }

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
      allowsMultiple: Boolean(poll.allowsMultiple),
    };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      title: validation.values.title,
      body: validation.values.body,
      visibility: validation.values.visibility,
    })
    .select("id")
    .single();

  if (postError) {
    console.error("CREATE POST INSERT ERROR:", {
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

  if (poll) {
    const { data: createdPoll, error: pollError } = await supabase
      .from("polls")
      .insert({
        post_id: post.id,
        question: poll.question,
        allows_multiple: poll.allowsMultiple,
      })
      .select("id")
      .single();

    if (pollError) {
      console.error("CREATE POLL ERROR:", {
        code: pollError.code,
        message: pollError.message,
        details: pollError.details,
        hint: pollError.hint,
      });

      await supabase.from("post_audit_logs").insert({
        post_id: post.id,
        user_id: user.id,
        event_type: "poll_create_failed",
        success: false,
        error_code: pollError.code,
        error_message: pollError.message,
        metadata: {
          source: "createPost",
          details: pollError.details,
          hint: pollError.hint,
        },
      });

      return {
        success: false,
        message: "Post created, but poll failed to save.",
        errors: {
          poll: "Post created, but poll failed to save.",
        },
        postId: post.id,
      };
    }

    const pollOptions = poll.options.map((optionText, index) => ({
      poll_id: createdPoll.id,
      option_text: optionText,
      display_order: index,
    }));

    const { error: pollOptionsError } = await supabase
      .from("poll_options")
      .insert(pollOptions);

    if (pollOptionsError) {
      console.error("CREATE POLL OPTIONS ERROR:", {
        code: pollOptionsError.code,
        message: pollOptionsError.message,
        details: pollOptionsError.details,
        hint: pollOptionsError.hint,
      });

      await supabase.from("post_audit_logs").insert({
        post_id: post.id,
        user_id: user.id,
        event_type: "poll_options_create_failed",
        success: false,
        error_code: pollOptionsError.code,
        error_message: pollOptionsError.message,
        metadata: {
          source: "createPost",
          details: pollOptionsError.details,
          hint: pollOptionsError.hint,
        },
      });

      return {
        success: false,
        message: "Post created, but poll options failed to save.",
        errors: {
          poll: "Post created, but poll options failed to save.",
        },
        postId: post.id,
      };
    }
  }

  await supabase.from("post_audit_logs").insert({
    post_id: post.id,
    user_id: user.id,
    event_type: "post_create_success",
    success: true,
    metadata: {
      source: "createPost",
      has_poll: Boolean(poll),
    },
  });

  const mentionText = `${validation.values.title || ""} ${
    validation.values.body || ""
  }`;

  const mentionResult = await createMentionNotifications({
    text: mentionText,
    actorId: user.id,
    postId: post.id,
  });

  if (!mentionResult.success) {
    console.error("CREATE POST MENTION NOTIFICATION ERROR:", mentionResult.error);
  }

  revalidatePath("/");
  revalidatePath("/posts");

  return {
    success: true,
    postId: post.id,
    errors: {},
  };
}