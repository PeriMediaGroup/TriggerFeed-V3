"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createMentionNotifications } from "@/features/mentions/actions/createMentionNotifications";

function normalizeCommentBody(body) {
  return String(body || "").trim();
}

function validateCommentBody(body) {
  if (!body) {
    return "Comment cannot be empty";
  }

  if (body.length > 5000) {
    return "Comment must be 5000 characters or less";
  }

  return null;
}

export async function createComment({ postId, body, parentCommentId = null }) {
  if (!postId) {
    return {
      success: false,
      error: "Missing post id",
    };
  }

  const cleanBody = normalizeCommentBody(body);
  const bodyError = validateCommentBody(cleanBody);

  if (bodyError) {
    return {
      success: false,
      error: bodyError,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "You must be logged in to comment",
    };
  }

  if (parentCommentId) {
    const { data: parentComment, error: parentError } = await supabase
      .from("comments")
      .select("id, post_id, parent_comment_id, is_deleted")
      .eq("id", parentCommentId)
      .maybeSingle();

    if (parentError || !parentComment) {
      return {
        success: false,
        error: "Parent comment not found",
      };
    }

    if (parentComment.post_id !== postId) {
      return {
        success: false,
        error: "Reply does not belong to this post",
      };
    }

    if (parentComment.parent_comment_id) {
      return {
        success: false,
        error: "Replies can only be added to top-level comments",
      };
    }

    if (parentComment.is_deleted) {
      return {
        success: false,
        error: "You cannot reply to a deleted comment",
      };
    }
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      parent_comment_id: parentCommentId || null,
      body: cleanBody,
    })
    .select("id, post_id")
    .single();

  if (error) {
    console.error("Error creating comment:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      success: false,
      error: error.message,
    };
  }

  const mentionResult = await createMentionNotifications({
    text: cleanBody,
    actorId: user.id,
    postId,
    commentId: comment.id,
  });

  if (!mentionResult.success) {
    console.error("CREATE COMMENT MENTION NOTIFICATION ERROR:", mentionResult.error);
  }

  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    error: null,
  };
}

export async function updateComment({ commentId, body }) {
  if (!commentId) {
    return {
      success: false,
      error: "Missing comment id",
    };
  }

  const cleanBody = normalizeCommentBody(body);
  const bodyError = validateCommentBody(cleanBody);

  if (bodyError) {
    return {
      success: false,
      error: bodyError,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "You must be logged in to edit a comment",
    };
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id, post_id, user_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError || !comment) {
    return {
      success: false,
      error: "Comment not found",
    };
  }

  if (comment.user_id !== user.id) {
    return {
      success: false,
      error: "You can only edit your own comments",
    };
  }

  if (comment.is_deleted) {
    return {
      success: false,
      error: "Deleted comments cannot be edited",
    };
  }

  const { error: updateError } = await supabase
    .from("comments")
    .update({
      body: cleanBody,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .eq("is_deleted", false);

  if (updateError) {
    console.error("Error updating comment:", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });

    return {
      success: false,
      error: updateError.message,
    };
  }

  revalidatePath(`/posts/${comment.post_id}`);

  return {
    success: true,
    error: null,
  };
}

export async function deleteComment({ commentId }) {
  if (!commentId) {
    return {
      success: false,
      error: "Missing comment id",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "You must be logged in to delete a comment",
    };
  }

  const { data: comment, error: commentError } = await supabase
    .from("comments")
    .select("id, post_id, user_id, is_deleted")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError || !comment) {
    return {
      success: false,
      error: "Comment not found",
    };
  }

  if (comment.user_id !== user.id) {
    return {
      success: false,
      error: "You can only delete your own comments",
    };
  }

  if (comment.is_deleted) {
    return {
      success: true,
      error: null,
    };
  }

  const now = new Date().toISOString();

  const { error: deleteError } = await supabase
    .from("comments")
    .update({
      is_deleted: true,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Error deleting comment:", {
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });

    return {
      success: false,
      error: deleteError.message,
    };
  }

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    error: null,
  };
}