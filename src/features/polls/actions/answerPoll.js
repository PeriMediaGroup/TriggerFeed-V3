"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function answerPoll({ pollId, optionId, postId }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in to answer a poll.",
    };
  }

  if (!pollId || !optionId) {
    return {
      success: false,
      message: "Missing poll answer.",
    };
  }

  const { data: existingResponse, error: existingResponseError } = await supabase
    .from("poll_responses")
    .select("id")
    .eq("poll_id", pollId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingResponseError) {
    console.error("GET POLL RESPONSE ERROR:", {
      code: existingResponseError.code,
      message: existingResponseError.message,
      details: existingResponseError.details,
      hint: existingResponseError.hint,
    });

    return {
      success: false,
      message: "Could not check your current poll answer.",
    };
  }

  if (existingResponse) {
    const { error: updateError } = await supabase
      .from("poll_responses")
      .update({
        option_id: optionId,
      })
      .eq("id", existingResponse.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("UPDATE POLL RESPONSE ERROR:", {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
      });

      return {
        success: false,
        message: "Could not update your poll answer.",
      };
    }
  } else {
    const { error: insertError } = await supabase
      .from("poll_responses")
      .insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      });

    if (insertError) {
      console.error("CREATE POLL RESPONSE ERROR:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });

      return {
        success: false,
        message: "Could not save your poll answer.",
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/posts");

  if (postId) {
    revalidatePath(`/posts/${postId}`);
  }

  return {
    success: true,
    message: "Poll answer saved.",
  };
}