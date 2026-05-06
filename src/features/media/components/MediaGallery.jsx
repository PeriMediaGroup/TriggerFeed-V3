"use client";

import { useMemo, useState } from "react";
import PhotoAlbum from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";

import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Counter from "yet-another-react-lightbox/plugins/counter";

import "react-photo-album/rows.css";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/counter.css";

import "./MediaGallery.scss";

function getImageUrl(image) {
  return (
    image?.url ||
    image?.secure_url ||
    image?.cloudinary_url ||
    image?.image_url ||
    image?.src ||
    ""
  );
}

function getImageAlt(image, index, fallbackAlt) {
  return image?.alt || image?.description || `${fallbackAlt} ${index + 1}`;
}

function getImageWidth(image) {
  return image?.width || image?.metadata?.width || 1200;
}

function getImageHeight(image) {
  return image?.height || image?.metadata?.height || 900;
}

function normalizeImages(images = [], fallbackAlt = "Post image") {
  return images
    .map((image, index) => {
      const src = typeof image === "string" ? image : getImageUrl(image);

      if (!src) return null;

      return {
        src,
        alt: typeof image === "string" ? `${fallbackAlt} ${index + 1}` : getImageAlt(image, index, fallbackAlt),
        width: typeof image === "string" ? 1200 : getImageWidth(image),
        height: typeof image === "string" ? 900 : getImageHeight(image),
      };
    })
    .filter(Boolean);
}

export default function MediaGallery({
  images = [],
  fallbackAlt = "Post image",
  layout = "rows",
}) {
  const [index, setIndex] = useState(-1);

  const photos = useMemo(
    () => normalizeImages(images, fallbackAlt),
    [images, fallbackAlt]
  );

  if (!photos.length) return null;

  if (photos.length === 1) {
    const photo = photos[0];

    return (
      <>
        <button
          type="button"
          className="media-gallery__single"
          onClick={() => setIndex(0)}
          aria-label="Open image full size"
        >
          <img
            src={photo.src}
            alt={photo.alt}
            className="media-gallery__single-image"
            loading="lazy"
          />
        </button>

        <Lightbox
          open={index >= 0}
          index={index}
          close={() => setIndex(-1)}
          slides={photos}
          plugins={[Zoom, Fullscreen, Counter]}
          carousel={{ finite: photos.length <= 1 }}
        />
      </>
    );
  }

  return (
    <div className="media-gallery">
      <PhotoAlbum
        layout={layout}
        photos={photos}
        targetRowHeight={220}
        spacing={6}
        onClick={({ index: clickedIndex }) => setIndex(clickedIndex)}
        render={{
          image: ({ alt = "", title, sizes, className, style, ...props }) => (
            <img
              {...props}
              alt={alt}
              title={title}
              sizes={sizes}
              className={`${className || ""} media-gallery__image`}
              style={style}
              loading="lazy"
            />
          ),
        }}
      />

      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={photos}
        plugins={[Zoom, Fullscreen, Thumbnails, Counter]}
        carousel={{ finite: photos.length <= 1 }}
        thumbnails={{
          position: "bottom",
          width: 96,
          height: 64,
          border: 1,
          borderRadius: 8,
          padding: 4,
          gap: 8,
        }}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
      />
    </div>
  );
}