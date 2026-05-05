"use client";

import { useTransition } from "react";
import { deletePost } from "@/features/posts/actions/deletePost";

export default function DeletePostButton({ postId }) {
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
    <button
      type="button"
      className="delete-post__button"
      onClick={handleDelete}
      disabled={isPending}
    >
      {isPending ? "Deleting..." : "Delete Post"}
    </button>
  );
}