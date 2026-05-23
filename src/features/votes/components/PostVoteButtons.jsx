"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { togglePostVote } from "../actions/togglePostVote";

export default function PostVoteButtons({
  postId,
  upvoteCount = 0,
  downvoteCount = 0,
  userVote = null,
}) {
  const [isPending, startTransition] = useTransition();

  const [voteState, setVoteState] = useState({
    upvoteCount,
    downvoteCount,
    userVote,
  });

  function handleVote(voteType) {
    startTransition(async () => {
      const result = await togglePostVote({
        postId,
        voteType,
      });

      if (!result.success) {
        toast.error(result.message || "Unable to update vote.");
        return;
      }

      if (result.vote) {
        setVoteState({
          upvoteCount: result.vote.upvote_count ?? 0,
          downvoteCount: result.vote.downvote_count ?? 0,
          userVote: result.vote.user_vote ?? null,
        });
      }
    });
  }

  const hasUpvoted = voteState.userVote === "upvote";
  const hasDownvoted = voteState.userVote === "downvote";

  return (
    <div className="post-votes" aria-label="Post votes">
      <button
        type="button"
        className={`post-votes__button post-votes__button--up ${
          hasUpvoted ? "post-votes__button--active" : ""
        }`}
        onClick={() => handleVote("upvote")}
        disabled={isPending}
        aria-pressed={hasUpvoted}
        title="Upvote"
      >
        <ThumbsUp className="post-votes__icon" aria-hidden="true" />
        <span className="post-votes__count">{voteState.upvoteCount}</span>
      </button>

      <button
        type="button"
        className={`post-votes__button post-votes__button--down ${
          hasDownvoted ? "post-votes__button--active" : ""
        }`}
        onClick={() => handleVote("downvote")}
        disabled={isPending}
        aria-pressed={hasDownvoted}
        title="Downvote"
      >
        <span className="post-votes__count">{voteState.downvoteCount}</span>
        <ThumbsDown className="post-votes__icon" aria-hidden="true" />
      </button>
    </div>
  );
}