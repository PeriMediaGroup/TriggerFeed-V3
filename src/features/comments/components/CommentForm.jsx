"use client";

import { useState, useTransition } from "react";
import { createComment } from "../actions";
import { Send } from "lucide-react";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

export default function CommentForm({ postId, isLoggedIn }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <section className="comment-form comment-form--logged-out">
        <p>You must be logged in to comment.</p>
      </section>
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    const cleanBody = body.trim();

    if (!cleanBody) {
      setError("Comment cannot be empty");
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await createComment({
        postId,
        body: cleanBody,
      });

      if (!result.success) {
        setError(result.error || "Something went wrong creating your comment");
        return;
      }

      setBody("");
    });
  }

  return (
    <section className="comment-form">
      {/*
      <p className="comment-form__title">Add a comment</p>
      */}

      <form className="comment-form__form" onSubmit={handleSubmit}>
        <MentionTextarea
          id="comment-body"
          className="comment-form__textarea"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a comment..."
          rows={3}
          maxLength={5000}
          disabled={isPending}
        />

        {error && <p className="comment-form__error">{error}</p>}

        <br />

        <button
          className="comment-form__button"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Posting..." : "Post Comment"}
        </button>

        <Send size={18} strokeWidth={2} aria-hidden="true" />
      </form>
    </section>
  );
}