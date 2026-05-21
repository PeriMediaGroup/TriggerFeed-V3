"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createPost } from "../../actions/createPost";
import { uploadFilesToCloudinary } from "@/features/media/uploadToCloudinaryClient";
import { savePostMedia } from "@/features/posts/actions/savePostMedia";
import PostComposer from "@/features/posts/components/PostComposer";

export default function CreatePostForm() {
  const router = useRouter();

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [mediaErrors, setMediaErrors] = useState([]);
  const [submitStep, setSubmitStep] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleComposerSubmit({ formData, mediaItems }) {
    return new Promise((resolve) => {
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
            resolve(false);
            return;
          }

          if (mediaItems.length > 0) {
            setStatus(
              mediaItems.length === 1
                ? "Uploading media..."
                : `Uploading ${mediaItems.length} media files...`,
            );

            const uploadedMedia = await uploadFilesToCloudinary({
              files: mediaItems.map((item) => item.file),
              postId: result.postId,
              onProgress: ({ index, total }) => {
                setSubmitStep(`Uploading media ${index + 1} of ${total}...`);
              },
            });

            setSubmitStep("Saving media...");

            const saveMediaResult = await savePostMedia({
              postId: result.postId,
              media: uploadedMedia,
            });

            if (!saveMediaResult.success) {
              const saveMediaErrors = saveMediaResult.errors || [];

              setMediaErrors(saveMediaErrors);
              setStatus(
                saveMediaErrors[0] || "Post created, but media failed to save.",
              );
              setSubmitStep("");
              resolve(false);
              return;
            }
          }

          setSubmitStep("Finishing up...");
          setStatus("Post created.");

          setTimeout(() => {
            window.location.assign(`/posts/${result.postId}`);
          }, 150);

          router.refresh();
          resolve(true);
        } catch (error) {
          console.error("CREATE POST SAVE ERROR:", error);
          setStatus(error?.message || "Create post failed. Check the console.");
          setSubmitStep("");
          resolve(false);
        }
      });
    });
  }

  return (
    <PostComposer
      mode="create"
      className="create-post"
      errors={errors}
      mediaErrors={mediaErrors}
      status={status}
      submitStep={submitStep}
      isPending={isPending}
      submitLabel="Post"
      pendingLabel="Posting..."
      onSubmit={handleComposerSubmit}
    />
  );
}
