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
            const imageUrl = item.cloudinary_secure_url || item.cloudinary_url;

            return (
              <div className="edit-post-media__item" key={item.id}>
                <div className="edit-post-media__image">
                  <Image
                    src={imageUrl}
                    alt={item.alt_text || "Post image"}
                    fill
                    sizes="(max-width: 700px) 50vw, 300px"
                  />
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