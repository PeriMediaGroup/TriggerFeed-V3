// src/features/posts/components/CreatePostForm.jsx

"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPost } from "../actions/createPost";
import PostMediaUploader from "@/features/posts/components/PostMediaUploader";
import { uploadPostMedia } from "@/features/posts/actions/uploadPostMedia";

export default function CreatePostForm() {
  const router = useRouter();
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaErrors, setMediaErrors] = useState([]);
  const [isPending, startTransition] = useTransition();
  const [submitStep, setSubmitStep] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
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

      if (mediaFiles.length > 0) {
        setSubmitStep(
          mediaFiles.length === 1
            ? "Uploading image..."
            : `Uploading ${mediaFiles.length} images...`,
        );

        const mediaResult = await uploadPostMedia({
          postId: result.postId,
          files: mediaFiles,
        });

        if (!mediaResult.success) {
          setMediaErrors(mediaResult.errors || ["Media upload failed."]);
          setStatus("Post was created, but media upload failed.");
          setSubmitStep("");
          return;
        }
      }

      setSubmitStep("Finishing up...");

      form.reset();
      setMediaFiles([]);
      setStatus("Post created.");

      router.replace(`/posts/${result.postId}`);
    });
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="post-form__field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={120} required />
        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <div className="post-form__field">
        <label htmlFor="body">Body</label>
        <textarea id="body" name="body" rows={6} maxLength={5000} />
        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <input type="hidden" name="visibility" value="public" />
      {errors.visibility && (
        <p className="post-form__error">{errors.visibility}</p>
      )}

      <PostMediaUploader onFilesChange={setMediaFiles} />

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
