// src/features/posts/components/PostActions.jsx

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deletePost } from "../actions/deletePost";

export default function PostActions({ postId }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Delete this post? This will hide it from the feed."
    );

    if (!confirmed) return;

    startTransition(async () => {
      await deletePost(postId);
    });
  }

  return (
    <div className="post-actions">
      <Link className="post-actions__edit" href={`/posts/${postId}/edit`}>
        Edit
      </Link>

      <button
        className="post-actions__delete"
        type="button"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}