// src/features/posts/components/EditPostForm.jsx

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePost } from "../actions/updatePost";
import { deletePostMedia } from "../actions/deletePostMedia";
import { uploadPostMedia } from "../actions/uploadPostMedia";
import EditPostMediaManager from "./EditPostMediaManager";

export default function EditPostForm({ post }) {
  const router = useRouter();

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setErrors({});
      setStatus("");

      const result = await updatePost(post.id, formData);

      if (!result.success) {
        setErrors(result.errors || {});
        setStatus(result.message || "Something went wrong.");
        return;
      }

      if (removedMediaIds.length > 0) {
        setStatus("Removing images...");

        const deleteMediaResult = await deletePostMedia({
          postId: post.id,
          mediaIds: removedMediaIds,
        });

        if (!deleteMediaResult.success) {
          setStatus("Post updated, but some media could not be removed.");
          return;
        }
      }

      if (newMediaFiles.length > 0) {
        setStatus(
          newMediaFiles.length === 1
            ? "Uploading image..."
            : `Uploading ${newMediaFiles.length} images...`,
        );

        const uploadMediaResult = await uploadPostMedia({
          postId: post.id,
          files: newMediaFiles,
        });

        if (!uploadMediaResult.success) {
          setStatus("Post updated, but new media could not be uploaded.");
          return;
        }
      }

      setStatus("Finishing up...");

      router.replace(`/posts/${post.id}`);
    });
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="post-form__field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={120}
          required
          defaultValue={post.title}
        />
        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <EditPostMediaManager
        media={post.media || []}
        onNewFilesChange={setNewMediaFiles}
        onRemovedMediaIdsChange={setRemovedMediaIds}
      />

      <div className="post-form__field">
        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={post.body || ""}
        />
        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <input type="hidden" name="visibility" value="public" />

      {errors.visibility && (
        <p className="post-form__error">{errors.visibility}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Changes"}
      </button>

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}