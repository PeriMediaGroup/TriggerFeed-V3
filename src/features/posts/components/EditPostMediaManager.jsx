"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

function getMediaUrl(item) {
  return (
    item?.secure_url ||
    item?.url ||
    item?.media_url ||
    item?.cloudinary_secure_url ||
    item?.cloudinary_url ||
    item?.thumbnail_url ||
    item?.external_url ||
    item?.image_url ||
    item?.video_url ||
    item?.previewUrl ||
    item?.preview_url ||
    ""
  );
}

function isVideoMedia(item) {
  const mediaType = `${item?.media_type || item?.type || ""}`.toLowerCase();
  const resourceType = `${item?.resource_type || ""}`.toLowerCase();

  return mediaType === "video" || resourceType === "video";
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
  const [selectedFiles, setSelectedFiles] = useState([]);

  const visibleMedia = useMemo(() => {
    return media.filter((item) => item?.id && !removedIds.includes(item.id));
  }, [media, removedIds]);

  function handleRemoveExistingMedia(mediaId) {
    const nextRemovedIds = [...removedIds, mediaId];

    setRemovedIds(nextRemovedIds);
    onRemovedMediaIdsChange?.(nextRemovedIds);
  }

  function handleFilesChange(event) {
    const files = Array.from(event.target.files || []);

    setSelectedFiles(files);
    onNewFilesChange?.(files);
    onAddMedia?.(files);
  }

  function handleRemoveNewMedia(mediaId) {
    onRemoveMedia?.(mediaId);

    const removedItem = mediaItems.find((item) => item.id === mediaId);
    const removedFile = removedItem?.file;

    if (!removedFile) {
      return;
    }

    const nextFiles = selectedFiles.filter((file) => file !== removedFile);

    setSelectedFiles(nextFiles);
    onNewFilesChange?.(nextFiles);
  }

  return (
    <section className="edit-post-media">
      <h2 className="edit-post-media__title">Post images</h2>

      {visibleMedia.length > 0 && (
        <div className="edit-post-media__existing-grid">
          {visibleMedia.map((item) => {
            const mediaUrl = getMediaUrl(item);

            if (!mediaUrl) {
              return null;
            }

            const isVideo = isVideoMedia(item);
            const isGiphy =
              `${item.provider || item.source || ""}`.toLowerCase() ===
                "giphy" ||
              `${item.media_type || item.type || ""}`.toLowerCase() === "gif";

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
                      alt={item.alt_text || item.title || "Post media"}
                      fill
                      sizes="(max-width: 700px) 50vw, 300px"
                      unoptimized={isGiphy}
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
        <p className="edit-post-media__empty">No images attached.</p>
      )}

      <div className="edit-post-media__uploader">
        <label className="edit-post-media__label" htmlFor="edit-post-media">
          Add images
        </label>

        <input
          id="edit-post-media"
          className="edit-post-media__input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFilesChange}
        />
      </div>

      {mediaItems.length > 0 && (
        <div className="edit-post-media__new-grid">
          {mediaItems.map((item) => {
            const previewUrl = item.previewUrl || item.preview_url || item.url;

            if (!previewUrl) {
              return null;
            }

            return (
              <div className="edit-post-media__item" key={item.id}>
                <div className="edit-post-media__image">
                  {item.type === "video" || item.media_type === "video" ? (
                    <video
                      src={previewUrl}
                      controls
                      className="edit-post-media__video"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt={item.file?.name || "New post media"}
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
    </section>
  );
}
