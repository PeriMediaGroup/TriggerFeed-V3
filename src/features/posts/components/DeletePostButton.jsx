"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import { deletePost } from "@/features/posts/actions/deletePost";

export default function DeletePostButton({ postId, variant = "default" }) {
  const [isPending, startTransition] = useTransition();
  const isIcon = variant === "icon";

  function handleDelete() {
    const confirmed = window.confirm(
      "Delete this post? This will hide it from the feed.",
    );

    if (!confirmed) return;

    startTransition(async () => {
      await deletePost(postId);
    });
  }

  return (
    <button
      type="button"
      className={
        isIcon
          ? "post-card__icon-action post-card__icon-action--danger"
          : "delete-post__button"
      }
      onClick={handleDelete}
      disabled={isPending}
      aria-label={isIcon ? "Delete post" : undefined}
      title={isIcon ? "Delete post" : undefined}
    >
      {isIcon ? (
        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
      ) : isPending ? (
        "Deleting..."
      ) : (
        "Delete Post"
      )}
    </button>
  );
}