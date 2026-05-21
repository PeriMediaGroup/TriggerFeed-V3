"use client";

import { useState, useTransition } from "react";
import { updatePost } from "../actions/updatePost";
import { uploadFilesToCloudinary } from "@/features/media/uploadToCloudinaryClient";
import { deletePostMedia } from "../actions/deletePostMedia";
import { savePostMedia } from "../actions/savePostMedia";
import EditPostMediaManager from "./EditPostMediaManager";

export default function EditPostForm({ post }) {
  const existingMedia = post.media || post.images || post.post_images || [];

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        setErrors({});
        setStatus("");

        const result = await updatePost(post.id, formData);

        if (!result.success) {
          setErrors(result.errors || {});
          setStatus(result.message || "Something went wrong.");
          return;
        }

        if (removedMediaIds.length > 0) {
          setStatus(
            removedMediaIds.length === 1
              ? "Removing media..."
              : `Removing ${removedMediaIds.length} media items...`,
          );

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
              ? "Uploading media..."
              : `Uploading ${newMediaFiles.length} media items...`,
          );

          const uploadedMedia = await uploadFilesToCloudinary({
            files: newMediaFiles,
            postId: post.id,
          });

          if (uploadedMedia.length > 0) {
            setStatus("Saving uploaded media...");

            const saveMediaResult = await savePostMedia({
              postId: post.id,
              media: uploadedMedia,
            });

            if (!saveMediaResult.success) {
              setStatus(
                saveMediaResult.message ||
                  "Post updated, but new media could not be saved.",
              );
              return;
            }
          }
        }

        setStatus("Post updated.");

        setTimeout(() => {
          window.location.assign(`/posts/${post.id}`);
        }, 150);
      } catch (error) {
        console.error("EDIT POST SAVE ERROR:", {
          message: error?.message,
          stack: error?.stack,
        });

        setStatus(error?.message || "Post save failed. Check the console.");
      }
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
        media={existingMedia}
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