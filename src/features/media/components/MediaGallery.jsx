"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";

import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Counter from "yet-another-react-lightbox/plugins/counter";

import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/counter.css";

import "../styles/MediaGallery.scss";

function getMediaUrl(media) {
  return (
    media?.src ||
    media?.cloudinary_secure_url ||
    media?.cloudinary_url ||
    media?.external_url ||
    media?.thumbnail_url ||
    media?.url ||
    media?.secure_url ||
    media?.image_url ||
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
  const width = Number(media?.width || media?.metadata?.width);

  return Number.isFinite(width) && width > 0 ? width : 1200;
}

function getMediaHeight(media) {
  const height = Number(media?.height || media?.metadata?.height);

  return Number.isFinite(height) && height > 0 ? height : 900;
}

function getMediaType(media) {
  if (typeof media === "string") return "image";

  return media?.mediaType || media?.media_type || media?.type || "image";
}

function getSortOrder(media, index) {
  if (typeof media === "string") return index;

  return media?.sortOrder ?? media?.sort_order ?? media?.display_order ?? index;
}

function normalizeMedia(items = [], fallbackAlt = "Post media") {
  const safeItems = Array.isArray(items) ? items : [];

  return [...safeItems]
    .sort((a, b) => {
      return getSortOrder(a, 0) - getSortOrder(b, 0);
    })
    .map((media, index) => {
      const src = typeof media === "string" ? media : getMediaUrl(media);

      if (!src) return null;

      const mediaType = getMediaType(media);

      return {
        id: typeof media === "string" ? src : media?.id || src,
        src,
        alt:
          typeof media === "string"
            ? `${fallbackAlt} ${index + 1}`
            : getMediaAlt(media, index, fallbackAlt),
        width: typeof media === "string" ? 1200 : getMediaWidth(media),
        height: typeof media === "string" ? 900 : getMediaHeight(media),
        mediaType,
        media_type: mediaType,
        provider: typeof media === "string" ? "" : media?.provider || "",
        publicId:
          typeof media === "string"
            ? ""
            : media?.publicId || media?.cloudinary_public_id || "",
        sortOrder: getSortOrder(media, index),
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
  const isGif = media.media_type === "gif" || media.mediaType === "gif";

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
      className="media-gallery__button"
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
}) {
  const [index, setIndex] = useState(-1);

  const mediaItems = useMemo(
    () => normalizeMedia(images, fallbackAlt),
    [images, fallbackAlt],
  );

  const imageItems = useMemo(() => {
    return mediaItems.filter((media) => {
      return media.media_type !== "video" && media.mediaType !== "video";
    });
  }, [mediaItems]);

  const lightboxSlides = useMemo(() => {
    return imageItems.map((media) => ({
      src: media.src,
      alt: media.alt,
      width: media.width,
      height: media.height,
      title: media.title,
    }));
  }, [imageItems]);

  if (!mediaItems.length) return null;

  if (mediaItems.length === 1) {
    const media = mediaItems[0];

    if (media.media_type === "video" || media.mediaType === "video") {
      return <VideoMedia media={media} />;
    }

    return (
      <>
        <div className="media-gallery media-gallery--single">
          <ImageMedia media={media} single onClick={() => setIndex(0)} />
        </div>

        <Lightbox
          open={index >= 0}
          index={index}
          close={() => setIndex(-1)}
          slides={lightboxSlides}
          plugins={[Zoom, Fullscreen, Counter]}
          carousel={{ finite: lightboxSlides.length <= 1 }}
          zoom={{
            maxZoomPixelRatio: 3,
            scrollToZoom: true,
          }}
        />
      </>
    );
  }

  return (
    <div
      className={`media-gallery media-gallery--grid media-gallery--count-${Math.min(
        mediaItems.length,
        4,
      )}`}
    >
      {mediaItems.map((media) => {
        if (media.media_type === "video" || media.mediaType === "video") {
          return <VideoMedia key={media.id || media.src} media={media} />;
        }

        const lightboxIndex = imageItems.findIndex((item) => {
          return item.src === media.src;
        });

        return (
          <ImageMedia
            key={media.id || media.src}
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