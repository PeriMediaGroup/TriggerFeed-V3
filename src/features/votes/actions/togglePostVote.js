"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function togglePostVote({ postId, voteType }) {
  const supabase = await createClient();

  if (!postId) {
    return {
      success: false,
      message: "Missing post id.",
    };
  }

  if (!["upvote", "downvote"].includes(voteType)) {
    return {
      success: false,
      message: "Invalid vote type.",
    };
  }

  const { data, error } = await supabase.rpc("toggle_post_vote", {
    target_post_id: postId,
    target_vote_type: voteType,
  });

  if (error) {
    console.error("TOGGLE POST VOTE ERROR:", error);

  const message =
    error.message === "You must be logged in to vote."
      ? "Log in to vote."
      : error.message || "Unable to update vote.";

    return {
      success: false,
      message,
    };
  }

  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);

  return {
    success: true,
    vote: data?.[0] ?? null,
  };
}