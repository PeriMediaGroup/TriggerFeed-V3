// src/features/posts/components/CreatePostForm.jsx

"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPost } from "../../actions/createPost";
import PostMediaUploader from "@/features/posts/components/PostMediaUploader";
import { uploadPostMedia } from "@/features/posts/actions/XXX-uploadPostMedia";
import MentionInput from "@/features/mentions/components/MentionInputs";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

export default function CreatePostForm() {
  const router = useRouter();
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaErrors, setMediaErrors] = useState([]);
  const [isPending, startTransition] = useTransition();
  const [uploaderKey, setUploaderKey] = useState(0);
  const [submitStep, setSubmitStep] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

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

        if (mediaFiles.length > 0) {
          setStatus(
            mediaFiles.length === 1
              ? "Uploading image..."
              : `Uploading ${mediaFiles.length} images...`,
          );

          const mediaFormData = new FormData();
          mediaFormData.append("postId", result.postId);

          mediaFiles.forEach((file) => {
            mediaFormData.append("files", file);
          });

          const uploadMediaResult = await uploadPostMedia(mediaFormData);

          if (!uploadMediaResult.success) {
            const uploadErrors = uploadMediaResult.errors || [];

            setMediaErrors(uploadErrors);
            setStatus(
              uploadErrors[0] || "Post created, but images failed to upload.",
            );
            setSubmitStep("");
            return;
          }
        }

        setSubmitStep("Finishing up...");

        form.reset();
        setMediaFiles([]);
        setUploaderKey((currentKey) => currentKey + 1);
        setStatus("Post created.");

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
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="post-form__field">
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

      <div className="post-form__field">
        <label htmlFor="body">Body</label>
        <MentionTextarea
          name="body"
          id="body"
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

      <PostMediaUploader key={uploaderKey} onFilesChange={setMediaFiles} />

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
