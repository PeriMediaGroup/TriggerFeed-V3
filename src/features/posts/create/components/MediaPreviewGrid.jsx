"use client";

import Image from "next/image";

export default function MediaPreviewGrid({ mediaItems, onRemoveMedia }) {
  if (!mediaItems?.length) return null;

  return (
    <div className="create-post__media-preview-grid">
      {mediaItems.map((item) => (
        <div key={item.id} className="create-post__media-preview-item">
          {item.mediaType === "video" ? (
            <video
              className="create-post__media-preview"
              src={item.previewUrl}
              controls
              muted
            />
          ) : (
            <Image
              className="create-post__media-preview"
              src={item.previewUrl}
              alt={item.name || "Selected upload"}
              width={300}
              height={300}
              unoptimized
            />
          )}

          <button
            className="create-post__media-remove"
            type="button"
            onClick={() => onRemoveMedia(item.id)}
            aria-label="Remove media"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
