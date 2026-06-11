"use client";

import Image from "next/image";
import { useState } from "react";
import PostMediaUploader from "./PostMediaUploader";

function getMediaUrl(item) {
  return (
    item.src ||
    item.secure_url ||
    item.url ||
    item.media_url ||
    item.cloudinary_secure_url ||
    item.cloudinary_url ||
    item.thumbnail_url ||
    item.external_url ||
    item.image_url ||
    item.video_url ||
    item.previewUrl ||
    item.preview_url ||
    item.preview ||
    null
  );
}

function isVideoMedia(item) {
  const mediaType =
    item.mediaType || item.media_type || item.resource_type || item.type || "";

  return mediaType === "video" || mediaType.startsWith("video/");
}

export default function EditPostMediaManager({
  media = [],
  mediaItems = [],
  onAddMedia,
  onRemoveMedia,
  onNewFilesChange,
  onRemovedMediaIdsChange,
}) {
  const [removedIds, setRemovedIds] = useState([]);

  const visibleMedia = media.filter((item) => !removedIds.includes(item.id));

  function handleRemoveExistingMedia(mediaId) {
    const nextRemovedIds = [...removedIds, mediaId];

    setRemovedIds(nextRemovedIds);
    onRemovedMediaIdsChange?.(nextRemovedIds);
  }

  function handleNewFilesChange(files) {
    const nextFiles = Array.from(files || []);

    if (nextFiles.length === 0) {
      return;
    }

    const nextMediaItems = onAddMedia?.(nextFiles) || [];

    onNewFilesChange?.((currentItems = []) => [
      ...Array.from(currentItems || []),
      ...nextMediaItems,
    ]);
  }

  function handleRemoveNewMedia(mediaId) {
    onRemoveMedia?.(mediaId);

    onNewFilesChange?.((currentItems = []) => {
      return Array.from(currentItems || []).filter((item) => {
        return item.id !== mediaId;
      });
    });
  }

  return (
    <section className="edit-post-media">
      <h2 className="edit-post-media__title">Post media</h2>

      {visibleMedia.length > 0 && (
        <div className="edit-post-media__existing-grid">
          {visibleMedia.map((item) => {
            const mediaUrl = getMediaUrl(item);

            if (!mediaUrl) {
              return null;
            }

            const isVideo = isVideoMedia(item);

            return (
              <div className="edit-post-media__item" key={item.id}>
                <div className="edit-post-media__image">
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      controls
                      className="edit-post-media__video"
                    />
                  ) : (
                    <Image
                      src={mediaUrl}
                      alt={
                        item.alt ||
                        item.alt_text ||
                        item.title ||
                        "Post media"
                      }
                      fill
                      sizes="(max-width: 700px) 50vw, 300px"
                      unoptimized={
                        item.provider === "giphy" ||
                        item.mediaType === "gif" ||
                        item.media_type === "gif" ||
                        item.type === "gif"
                      }
                    />
                  )}
                </div>

                <button
                  type="button"
                  className="edit-post-media__remove"
                  onClick={() => handleRemoveExistingMedia(item.id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {visibleMedia.length === 0 && (
        <p className="edit-post-media__empty">No existing media attached.</p>
      )}

      {mediaItems.length > 0 && (
        <div className="edit-post-media__new-grid">
          {mediaItems.map((item) => {
            const mediaUrl = getMediaUrl(item);

            if (!mediaUrl) {
              return null;
            }

            const isVideo = isVideoMedia(item);

            return (
              <div className="edit-post-media__item" key={item.id}>
                <div className="edit-post-media__image">
                  {isVideo ? (
                    <video
                      src={mediaUrl}
                      controls
                      className="edit-post-media__video"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl}
                      alt={item.name || "New post media preview"}
                      className="edit-post-media__preview-image"
                    />
                  )}
                </div>

                <button
                  type="button"
                  className="edit-post-media__remove"
                  onClick={() => handleRemoveNewMedia(item.id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PostMediaUploader onFilesChange={handleNewFilesChange} />
    </section>
  );
}
