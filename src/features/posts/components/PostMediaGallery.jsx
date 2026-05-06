"use client";

import Image from "next/image";

export default function PostMediaGallery({ media = [] }) {
  const images = media
    .filter((item) => item.media_type === "image")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (images.length === 0) return null;

  const galleryClassName =
    images.length === 1
      ? "post-media-gallery post-media-gallery--single"
      : images.length === 2
        ? "post-media-gallery post-media-gallery--two"
        : "post-media-gallery post-media-gallery--grid";

  return (
    <div className={galleryClassName}>
      {images.slice(0, 4).map((image, index) => {
        const imageUrl = image.cloudinary_secure_url || image.cloudinary_url;
        const hiddenCount = images.length - 4;
        const showOverlay = index === 3 && hiddenCount > 0;

        return (
          <button
            key={image.id}
            type="button"
            className="post-media-gallery__item"
          >
            <Image
              src={imageUrl}
              alt={image.alt_text || "Post image"}
              fill
              sizes="(max-width: 700px) 100vw, 700px"
              priority={index === 0}
            />

            {showOverlay && (
              <span className="post-media-gallery__overlay">
                +{hiddenCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
