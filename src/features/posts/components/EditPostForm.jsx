"use client";

import { useMemo, useState, useTransition } from "react";

import { updatePost } from "../actions/updatePost";
import { uploadFilesToCloudinary } from "@/features/media/uploadToCloudinaryClient";
import { deletePostMedia } from "../actions/deletePostMedia";
import { savePostMedia } from "../actions/savePostMedia";
import EditPostMediaManager from "./EditPostMediaManager";
import PostComposer from "@/features/posts/components/PostComposer";

function getMediaUrl(item) {
  return (
    item?.src ||
    item?.secure_url ||
    item?.url ||
    item?.media_url ||
    item?.cloudinary_secure_url ||
    item?.cloudinary_url ||
    item?.thumbnail_url ||
    item?.external_url ||
    item?.image_url ||
    item?.video_url ||
    ""
  );
}

function getExistingMedia(post) {
  const mediaSource =
    post?.media ||
    post?.post_media ||
    post?.postMedia ||
    post?.images ||
    post?.post_images ||
    [];

  if (!Array.isArray(mediaSource)) {
    return [];
  }

  return mediaSource
    .map((item, index) => {
      const mediaUrl = getMediaUrl(item);
      const mediaType =
        item.mediaType ||
        item.media_type ||
        item.type ||
        item.resource_type ||
        "image";

      const publicId =
        item.publicId || item.public_id || item.cloudinary_public_id || "";

      const sortOrder =
        item.sortOrder ??
        item.sort_order ??
        item.display_order ??
        item.position ??
        index;

      return {
        ...item,
        id: item.id,
        post_id: item.post_id || item.postId || post?.id,

        // normalized/render-friendly
        src: item.src || mediaUrl,
        alt: item.alt || item.alt_text || item.title || "",
        mediaType,
        publicId,
        sortOrder,

        // legacy/db-ish compatibility for edit manager/actions
        url: mediaUrl,
        secure_url: item.secure_url || mediaUrl,
        media_url: item.media_url || mediaUrl,
        cloudinary_secure_url: item.cloudinary_secure_url || mediaUrl,
        cloudinary_url: item.cloudinary_url || mediaUrl,
        public_id: publicId,
        cloudinary_public_id: item.cloudinary_public_id || publicId,
        media_type: mediaType,
        type: item.type || mediaType,
        resource_type: item.resource_type || mediaType,
        provider: item.provider || item.source || "",
        alt_text: item.alt_text || item.alt || item.title || "",
        title: item.title || item.alt_text || item.alt || "",
        sort_order: sortOrder,
        display_order: item.display_order ?? sortOrder,
      };
    })
    .filter((item) => item.id && getMediaUrl(item));
}

function getInitialPoll(post) {
  const pollSource = Array.isArray(post?.polls)
    ? post.polls[0]
    : post?.poll ||
      post?.post_poll ||
      post?.post_polls ||
      post?.poll_draft ||
      null;

  if (!pollSource) {
    return null;
  }

  const optionSource =
    pollSource.options ||
    pollSource.poll_options ||
    pollSource.post_poll_options ||
    pollSource.pollOptions ||
    [];

  return {
    id: pollSource.id || null,
    question:
      pollSource.question || pollSource.title || pollSource.prompt || "",
    options: Array.isArray(optionSource)
      ? optionSource.map((option) => {
          if (typeof option === "string") {
            return option;
          }

          return (
            option.text ||
            option.label ||
            option.option_text ||
            option.body ||
            option.value ||
            option.option ||
            option.title ||
            ""
          );
        })
      : [],
  };
}

function isGifMedia(item) {
  const rawMediaType = item?.mediaType || item?.media_type || item?.type || "";
  const mediaType = `${rawMediaType}`.toLowerCase();
  const provider = `${item?.provider || item?.source || ""}`.toLowerCase();

  return mediaType === "gif" || mediaType === "giphy" || provider === "giphy";
}

function getInitialGif(post) {
  const directGif =
    post?.gif ||
    post?.selectedGif ||
    post?.giphy ||
    post?.post_gif ||
    post?.gif_media ||
    null;

  if (directGif) {
    return directGif;
  }

  const mediaSource =
    post?.media ||
    post?.post_media ||
    post?.postMedia ||
    post?.images ||
    post?.post_images ||
    [];

  if (!Array.isArray(mediaSource)) {
    return null;
  }

  const gifMedia = mediaSource.find(isGifMedia);

  if (!gifMedia) {
    return null;
  }

  const gifUrl = getMediaUrl(gifMedia);

  return {
    ...gifMedia,
    id: gifMedia.publicId || gifMedia.public_id || gifMedia.id || "",
    mediaId: gifMedia.id,
    url: gifUrl,
    secure_url: gifUrl,
    title: gifMedia.title || gifMedia.alt || gifMedia.alt_text || "GIPHY",
    provider: gifMedia.provider || "giphy",
  };
}

function applyUploadedMediaDisplayOffset({
  uploadedMedia,
  existingMedia,
  removedMediaIds,
}) {
  const remainingExistingMedia = existingMedia.filter((item) => {
    return !removedMediaIds.includes(item.id);
  });

  const maxExistingOrder = remainingExistingMedia.reduce((maxOrder, item) => {
    const itemOrder = Number(item.display_order ?? item.sort_order ?? -1);
    return Number.isFinite(itemOrder)
      ? Math.max(maxOrder, itemOrder)
      : maxOrder;
  }, -1);

  const startingOrder = maxExistingOrder + 1;

  return uploadedMedia.map((item, index) => {
    const displayOrder = startingOrder + index;

    return {
      ...item,
      sort_order: displayOrder,
      display_order: displayOrder,
    };
  });
}

export default function EditPostForm({ post, canCreateStickyPost = false }) {
  const [errors, setErrors] = useState({});
  const [mediaErrors, setMediaErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [submitStep, setSubmitStep] = useState("");
  const [isPending, startTransition] = useTransition();
  const [newMediaItems, setNewMediaItems] = useState([]);
  const [removedMediaIds, setRemovedMediaIds] = useState([]);

  const existingMedia = useMemo(() => getExistingMedia(post), [post]);
  const editableExistingMedia = useMemo(() => {
    return existingMedia.filter((item) => !isGifMedia(item));
  }, [existingMedia]);
  const remainingEditableExistingMedia = useMemo(() => {
    return editableExistingMedia.filter((item) => {
      return !removedMediaIds.includes(item.id);
    });
  }, [editableExistingMedia, removedMediaIds]);
  const initialPoll = useMemo(() => getInitialPoll(post), [post]);
  const initialGif = useMemo(() => getInitialGif(post), [post]);

  async function handleComposerSubmit({ formData, cleanedPoll }) {
    if (initialPoll && !cleanedPoll) {
      formData.set("remove_poll", "true");
    }

    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          setErrors({});
          setMediaErrors([]);
          setStatus("");
          setSubmitStep("Saving post...");

          const result = await updatePost(post.id, formData);

          if (!result.success) {
            setErrors(result.errors || {});
            setStatus(result.message || "Something went wrong.");
            setSubmitStep("");
            resolve(false);
            return;
          }

          if (removedMediaIds.length > 0) {
            setStatus(
              removedMediaIds.length === 1
                ? "Removing media..."
                : `Removing ${removedMediaIds.length} media items...`,
            );
            setSubmitStep("Removing media...");

            const deleteMediaResult = await deletePostMedia({
              postId: post.id,
              mediaIds: removedMediaIds,
            });

            if (!deleteMediaResult.success) {
              setStatus("Post updated, but some media could not be removed.");
              setSubmitStep("");
              resolve(false);
              return;
            }
          }

          if (newMediaItems.length > 0) {
            setStatus(
              newMediaItems.length === 1
                ? "Uploading media..."
                : `Uploading ${newMediaItems.length} media items...`,
            );

            const uploadedMedia = await uploadFilesToCloudinary({
              files: newMediaItems.map((item) => item.file).filter(Boolean),
              postId: post.id,
              onProgress: ({ index, total } = {}) => {
                if (typeof index === "number" && typeof total === "number") {
                  setSubmitStep(`Uploading media ${index + 1} of ${total}...`);
                } else {
                  setSubmitStep("Uploading media...");
                }
              },
            });

            if (uploadedMedia.length > 0) {
              setStatus("Saving uploaded media...");
              setSubmitStep("Saving uploaded media...");

              const orderedUploadedMedia = applyUploadedMediaDisplayOffset({
                uploadedMedia,
                existingMedia,
                removedMediaIds,
              });

              const saveMediaResult = await savePostMedia({
                postId: post.id,
                media: orderedUploadedMedia,
              });

              if (!saveMediaResult.success) {
                const saveMediaErrors = saveMediaResult.errors || [];

                setMediaErrors(saveMediaErrors);
                setStatus(
                  saveMediaResult.message ||
                    saveMediaErrors[0] ||
                    "Post updated, but new media could not be saved.",
                );
                setSubmitStep("");
                resolve(false);
                return;
              }
            }
          }

          setSubmitStep("Finishing up...");
          setStatus("Post updated.");

          setTimeout(() => {
            window.location.assign(`/posts/${post.id}`);
          }, 150);

          resolve(false);
        } catch (error) {
          console.error("EDIT POST SAVE ERROR:", {
            message: error?.message,
            stack: error?.stack,
          });

          setStatus(error?.message || "Post save failed. Check the console.");
          setSubmitStep("");
          resolve(false);
        }
      });
    });
  }

  return (
    <PostComposer
      key={post.id}
      mode="edit"
      initialTitle={post.title || ""}
      initialBody={post.body || ""}
      initialIsSticky={post.is_sticky === true}
      canCreateStickyPost={canCreateStickyPost}
      initialPoll={initialPoll}
      initialGif={initialGif}
      errors={errors}
      mediaErrors={mediaErrors}
      status={status}
      submitStep={submitStep}
      isPending={isPending}
      submitLabel="Save Changes"
      pendingLabel="Saving..."
      bodyPlaceholder="Update your post..."
      existingMediaItems={remainingEditableExistingMedia}
      renderMediaManager={({ mediaItems, onAddMedia, onRemoveMedia }) => (
        <EditPostMediaManager
          media={editableExistingMedia}
          mediaItems={mediaItems}
          onAddMedia={onAddMedia}
          onRemoveMedia={onRemoveMedia}
          onNewFilesChange={setNewMediaItems}
          onRemovedMediaIdsChange={setRemovedMediaIds}
        />
      )}
      onSubmit={handleComposerSubmit}
    />
  );
}
