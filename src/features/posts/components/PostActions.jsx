"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost } from "@/features/posts/actions/deletePost";

export default function PostActions({ postId, isOwner }) {
  const router = useRouter();
  const [error, setError] = useState("");
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

    setError("");

    startTransition(async () => {
      const result = await deletePost(postId);

      if (!result.success) {
        setError(result.error || "Could not delete post.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="post-actions">
      <Link href={`/posts/${postId}/edit`}>Edit Post</Link>
      {" | "}
      <button type="button" onClick={handleDelete} disabled={isPending}>
        {isPending ? "Deleting..." : "Delete Post"}
      </button>

      {error && <p className="post-actions__error">{error}</p>}
    </div>
  );
}