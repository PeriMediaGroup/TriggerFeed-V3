"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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

import "../styles/MediaGallery.scss";

function getMediaUrl(media) {
  return (
    media?.external_url ||
    media?.thumbnail_url ||
    media?.cloudinary_secure_url ||
    media?.cloudinary_url ||
    media?.url ||
    media?.secure_url ||
    media?.image_url ||
    media?.src ||
    ""
  );
}

function getMediaAlt(media, index, fallbackAlt) {
  return (
    media?.alt_text ||
    media?.alt ||
    media?.title ||
    media?.description ||
    `${fallbackAlt} ${index + 1}`
  );
}

function getMediaWidth(media) {
  return media?.width || media?.metadata?.width || 1200;
}

function getMediaHeight(media) {
  return media?.height || media?.metadata?.height || 900;
}

function getMediaType(media) {
  if (typeof media === "string") return "image";

  return media?.media_type || media?.type || "image";
}

function normalizeMedia(items = [], fallbackAlt = "Post media") {
  return [...items]
    .sort((a, b) => {
      const orderA = a?.display_order ?? a?.sort_order ?? 0;
      const orderB = b?.display_order ?? b?.sort_order ?? 0;

      return orderA - orderB;
    })
    .map((media, index) => {
      const src = typeof media === "string" ? media : getMediaUrl(media);

      if (!src) return null;

      return {
        src,
        alt:
          typeof media === "string"
            ? `${fallbackAlt} ${index + 1}`
            : getMediaAlt(media, index, fallbackAlt),
        width: typeof media === "string" ? 1200 : getMediaWidth(media),
        height: typeof media === "string" ? 900 : getMediaHeight(media),
        media_type: getMediaType(media),
        title: typeof media === "string" ? "" : media?.title || "",
      };
    })
    .filter(Boolean);
}

function VideoMedia({ media }) {
  return (
    <figure className="media-gallery__item media-gallery__item--video">
      <video
        className="media-gallery__video"
        src={media.src}
        controls
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </figure>
  );
}

function ImageMedia({ media, onClick, single = false }) {
  const isGif = media.media_type === "gif";

  const figure = (
    <figure
      className={`media-gallery__item${
        isGif ? " media-gallery__item--gif" : ""
      }`}
    >
      <Image
        className={`media-gallery__image${
          single ? " media-gallery__single-image" : ""
        }${isGif ? " media-gallery__image--gif" : ""}`}
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading="lazy"
        unoptimized={isGif}
      />

      {isGif && (
        <figcaption className="media-gallery__credit">
          GIF via GIPHY
        </figcaption>
      )}
    </figure>
  );

  if (!onClick) {
    return figure;
  }

  return (
    <button
      type="button"
      className="media-gallery__single"
      onClick={onClick}
      aria-label="Open media full size"
    >
      {figure}
    </button>
  );
}

export default function MediaGallery({
  images = [],
  fallbackAlt = "Post media",
  layout = "rows",
}) {
  const [index, setIndex] = useState(-1);

  const mediaItems = useMemo(
    () => normalizeMedia(images, fallbackAlt),
    [images, fallbackAlt],
  );

  const lightboxSlides = useMemo(() => {
    return mediaItems.filter((media) => media.media_type !== "video");
  }, [mediaItems]);

  if (!mediaItems.length) return null;

  if (mediaItems.length === 1) {
    const media = mediaItems[0];

    if (media.media_type === "video") {
      return <VideoMedia media={media} />;
    }

    return (
      <>
        <ImageMedia media={media} single onClick={() => setIndex(0)} />

        <Lightbox
          open={index >= 0}
          index={index}
          close={() => setIndex(-1)}
          slides={lightboxSlides}
          plugins={[Zoom, Fullscreen, Counter]}
          carousel={{ finite: lightboxSlides.length <= 1 }}
        />
      </>
    );
  }

  const hasVideo = mediaItems.some((media) => media.media_type === "video");

  if (hasVideo) {
    return (
      <div className="media-gallery media-gallery--mixed">
        {mediaItems.map((media, mediaIndex) => {
          if (media.media_type === "video") {
            return <VideoMedia key={media.src} media={media} />;
          }

          const lightboxIndex = lightboxSlides.findIndex((slide) => {
            return slide.src === media.src;
          });

          return (
            <ImageMedia
              key={media.src}
              media={media}
              onClick={() => setIndex(lightboxIndex)}
            />
          );
        })}

        <Lightbox
          open={index >= 0}
          index={index}
          close={() => setIndex(-1)}
          slides={lightboxSlides}
          plugins={[Zoom, Fullscreen, Thumbnails, Counter]}
          carousel={{ finite: lightboxSlides.length <= 1 }}
        />
      </div>
    );
  }

  return (
    <div className="media-gallery">
      <PhotoAlbum
        layout={layout}
        photos={mediaItems}
        targetRowHeight={220}
        spacing={6}
        onClick={({ index: clickedIndex }) => setIndex(clickedIndex)}
        render={{
          image: ({ alt = "", title, sizes, className, style, ...props }) => {
            const media = mediaItems.find((item) => item.src === props.src);
            const isGif = media?.media_type === "gif";

            return (
              <figure
                className={`media-gallery__item${
                  isGif ? " media-gallery__item--gif" : ""
                }`}
              >
                <Image
                  {...props}
                  alt={alt}
                  title={title}
                  sizes={sizes}
                  width={media?.width || props.width || 1200}
                  height={media?.height || props.height || 900}
                  className={`${className || ""} media-gallery__image${
                    isGif ? " media-gallery__image--gif" : ""
                  }`}
                  // Required by react-photo-album for calculated image layout.
                  style={style}
                  loading="lazy"
                  unoptimized={isGif}
                />

                {isGif && (
                  <figcaption className="media-gallery__credit">
                    GIF via GIPHY
                  </figcaption>
                )}
              </figure>
            );
          },
        }}
      />

      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={lightboxSlides}
        plugins={[Zoom, Fullscreen, Thumbnails, Counter]}
        carousel={{ finite: lightboxSlides.length <= 1 }}
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
