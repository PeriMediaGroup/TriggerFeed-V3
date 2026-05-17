"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createPost } from "../../actions/createPost";
import { uploadPostMedia } from "@/features/posts/actions/uploadPostMedia";

import MentionInput from "@/features/mentions/components/MentionInputs";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

import CreatePostToolbar from "./CreatePostToolbar";
import MediaPicker from "./MediaPicker";
import MediaPreviewGrid from "./MediaPreviewGrid";
import CreatePostEmojiPicker from "./CreatePostEmojiPicker";

import {
  createMediaItemsFromFiles,
  revokeMediaPreview,
  revokeMediaPreviews,
} from "../utils/mediaHelpers";

export default function CreatePostForm() {
  const router = useRouter();

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [mediaErrors, setMediaErrors] = useState([]);
  const [mediaItems, setMediaItems] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [submitStep, setSubmitStep] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [isPending, startTransition] = useTransition();

  const mediaItemsRef = useRef([]);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => {
    return () => {
      revokeMediaPreviews(mediaItemsRef.current);
    };
  }, []);

  function handleInsertEmoji(emoji) {
    setBody((currentBody) => `${currentBody}${emoji}`);
  }

  function handleAddMedia(files) {
    const nextMediaItems = createMediaItemsFromFiles(files);

    setMediaItems((currentItems) => [...currentItems, ...nextMediaItems]);
  }

  function handleRemoveMedia(mediaId) {
    setMediaItems((currentItems) => {
      const itemToRemove = currentItems.find((item) => item.id === mediaId);

      revokeMediaPreview(itemToRemove);

      return currentItems.filter((item) => item.id !== mediaId);
    });
  }

  function resetForm(form) {
    form.reset();

    revokeMediaPreviews(mediaItemsRef.current);

    setTitle("");
    setBody("");
    setMediaItems([]);
    setActiveTool(null);
    setMediaErrors([]);
  }

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        setErrors({});
        setMediaErrors([]);
        setStatus("");
        setSubmitStep("Creating post...");

        const result = await createPost(formData);

        if (!result.success) {
          setErrors(result.errors || {});
          setStatus(result.message || "Something went wrong.");
          setSubmitStep("");
          return;
        }

        if (mediaItems.length > 0) {
          setStatus(
            mediaItems.length === 1
              ? "Uploading media..."
              : `Uploading ${mediaItems.length} media files...`,
          );

          const mediaFormData = new FormData();

          mediaFormData.append("postId", result.postId);

          mediaItems.forEach((item) => {
            mediaFormData.append("files", item.file);
          });

          const uploadMediaResult = await uploadPostMedia(mediaFormData);

          if (!uploadMediaResult.success) {
            const uploadErrors = uploadMediaResult.errors || [];

            setMediaErrors(uploadErrors);
            setStatus(
              uploadErrors[0] || "Post created, but media failed to upload.",
            );
            setSubmitStep("");
            return;
          }
        }

        setSubmitStep("Finishing up...");
        setStatus("Post created.");

        resetForm(form);

        setTimeout(() => {
          window.location.assign(`/posts/${result.postId}`);
        }, 150);

        router.refresh();
      } catch (error) {
        console.error("CREATE POST SAVE ERROR:", error);
        setStatus(error?.message || "Create post failed. Check the console.");
        setSubmitStep("");
      }
    });
  }

  return (
    <form className="post-form create-post" onSubmit={handleSubmit}>
      <div className="post-form__field create-post__field">
        <label htmlFor="title">Title</label>

        <MentionInput
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Post title"
          maxLength={120}
        />

        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <div className="post-form__field create-post__field">
        <label htmlFor="body">Body</label>

        <MentionTextarea
          id="body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          maxLength={5000}
        />

        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <input type="hidden" name="visibility" value="public" />

      {errors.visibility && (
        <p className="post-form__error">{errors.visibility}</p>
      )}

      <CreatePostToolbar activeTool={activeTool} onSelectTool={setActiveTool} />

      {activeTool === "media" && <MediaPicker onAddMedia={handleAddMedia} />}
      {activeTool === "emoji" && (
        <CreatePostEmojiPicker onSelectEmoji={handleInsertEmoji} />
      )}

      <MediaPreviewGrid
        mediaItems={mediaItems}
        onRemoveMedia={handleRemoveMedia}
      />

      {mediaErrors.length > 0 && (
        <div className="create-post__media-errors">
          {mediaErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? submitStep || "Posting..." : "Post"}
      </button>

      {isPending && submitStep && (
        <p className="create-post__submit-step">{submitStep}</p>
      )}

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}
