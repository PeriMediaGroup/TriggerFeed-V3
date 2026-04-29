"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deletePost } from "@/features/posts/actions/deletePost";

export default function PostActions({ postId, isOwner }) {
  const [isPending, startTransition] = useTransition();

  if (!isOwner) {
    return null;
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "Delete this post? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await deletePost(postId);
    });
  }

  return (
    <div className="post-actions">
      <Link href={`/posts/${postId}/edit`}>Edit Post</Link>
      {" | "}
      <button type="button" onClick={handleDelete} disabled={isPending}>
        {isPending ? "Deleting..." : "Delete Post"}
      </button>
    </div>
  );
}