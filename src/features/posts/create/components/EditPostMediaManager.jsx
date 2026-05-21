"use client";

import Image from "next/image";
import { useState } from "react";
import PostMediaUploader from "./PostMediaUploader";

export default function EditPostMediaManager({
  media = [],
  onNewFilesChange,
  onRemovedMediaIdsChange,
}) {
  const [removedIds, setRemovedIds] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const visibleMedia = media.filter((item) => !removedIds.includes(item.id));

  function handleRemoveExistingMedia(mediaId) {
    const nextRemovedIds = [...removedIds, mediaId];

    setRemovedIds(nextRemovedIds);
    onRemovedMediaIdsChange(nextRemovedIds);
  }

  return (
    <section className="edit-post-media">
      <h2 className="edit-post-media__title">Post images</h2>

      {visibleMedia.length > 0 && (
        <div className="edit-post-media__existing-grid">
          {visibleMedia.map((item) => {
            const mediaUrl =
              item.cloudinary_secure_url ||
              item.cloudinary_url ||
              item.thumbnail_url ||
              item.external_url ||
              null;

            if (!mediaUrl) {
              return null;
            }

            const isVideo = item.media_type === "video";

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
                      unoptimized={item.provider === "giphy"}
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

      <PostMediaUploader onFilesChange={onNewFilesChange} />
    </section>
  );
}
