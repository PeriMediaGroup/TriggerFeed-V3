"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost } from "@/features/posts/actions/deletePost";
import { Pencil, Trash2 } from "lucide-react";

export default function PostActions({ postId, isOwner }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!isOwner) {
    return null;
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "Remove this post? This will hide it from the feed.",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    startTransition(async () => {
      const result = await deletePost(postId);

      if (!result.success) {
        setError(result.error || "Could not remove post.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="post-actions">
      <Link href={`/posts/${postId}/edit`}>
        <Pencil size={16} strokeWidth={2} aria-hidden="true" />
        <span>Edit Post</span>
      </Link>
      {" | "}
      <button type="button" onClick={handleDelete} disabled={isPending}>
        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
        <span>{isPending ? "Removing..." : "Remove Post"}</span>
      </button>

      {error && <p className="post-actions__error">{error}</p>}
    </div>
  );
}
