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

const PORTRAIT_THRESHOLD = 0.75;
const WIDE_THRESHOLD = 1.6;
const STRONG_PORTRAIT_THRESHOLD = 0.7;
const STRONG_WIDE_THRESHOLD = 1.8;

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
    media?.media_url ||
    media?.video_url ||
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
  const width = Number(
    media?.width ||
      media?.metadata?.width ||
      media?.original_width ||
      media?.images?.original?.width,
  );

  return Number.isFinite(width) && width > 0 ? width : null;
}

function getMediaHeight(media) {
  const height = Number(
    media?.height ||
      media?.metadata?.height ||
      media?.original_height ||
      media?.images?.original?.height,
  );

  return Number.isFinite(height) && height > 0 ? height : null;
}

function getMediaType(media) {
  if (typeof media === "string") return "image";

  const mediaType =
    media?.mediaType || media?.media_type || media?.type || "image";

  return `${mediaType}`.toLowerCase();
}

function getSortOrder(media, index) {
  if (typeof media === "string") return index;

  return media?.sortOrder ?? media?.sort_order ?? media?.display_order ?? index;
}

function isVideoMedia(media) {
  return media.media_type === "video" || media.mediaType === "video";
}

function isGifMedia(media) {
  return (
    media.media_type === "gif" ||
    media.mediaType === "gif" ||
    `${media.provider || ""}`.toLowerCase() === "giphy"
  );
}

function getFallbackDimensions(mediaType) {
  if (mediaType === "video") {
    return {
      width: 1600,
      height: 900,
    };
  }

  return {
    width: 1000,
    height: 1000,
  };
}

function getMediaShape(aspectRatio) {
  if (aspectRatio <= PORTRAIT_THRESHOLD) return "portrait";
  if (aspectRatio >= WIDE_THRESHOLD) return "wide";

  return "standard";
}

function getMediaShapeFlags(aspectRatio) {
  return {
    shape: getMediaShape(aspectRatio),
    isStrongPortrait: aspectRatio <= STRONG_PORTRAIT_THRESHOLD,
    isStrongWide: aspectRatio >= STRONG_WIDE_THRESHOLD,
  };
}

function moveHeroFirst(mediaItems, heroIndex) {
  if (heroIndex <= 0) return mediaItems;

  const hero = mediaItems[heroIndex];

  return [
    hero,
    ...mediaItems.slice(0, heroIndex),
    ...mediaItems.slice(heroIndex + 1),
  ];
}

function getDefaultLayoutClassName(mediaCount) {
  if (mediaCount <= 1) return "single";
  if (mediaCount === 2) return "two";
  if (mediaCount === 3) return "three";
  if (mediaCount === 4) return "four";

  return "grid";
}

function pickGalleryLayout(mediaItems) {
  const mediaCount = mediaItems.length;

  if (mediaCount <= 1) {
    return {
      layout: "single",
      displayMedia: mediaItems,
      heroId: mediaItems[0]?.id || null,
      visibleLimit: 1,
    };
  }

  if (mediaCount === 2) {
    const wideIndex = mediaItems.findIndex((item, index) => {
      const otherItem = mediaItems[index === 0 ? 1 : 0];
      return item.shape === "wide" && otherItem?.shape !== "wide";
    });

    if (wideIndex >= 0) {
      const displayMedia = moveHeroFirst(mediaItems, wideIndex);

      return {
        layout: "wide-hero",
        displayMedia,
        heroId: displayMedia[0]?.id || null,
        visibleLimit: 2,
      };
    }
  }

  const strongWideIndex = mediaItems.findIndex((item) => item.isStrongWide);

  if (strongWideIndex >= 0) {
    const displayMedia = moveHeroFirst(mediaItems, strongWideIndex);

    return {
      layout: "wide-hero",
      displayMedia,
      heroId: displayMedia[0]?.id || null,
      visibleLimit: 6,
    };
  }

  const strongPortraitIndex = mediaItems.findIndex((item) => {
    return item.isStrongPortrait;
  });

  if (strongPortraitIndex >= 0) {
    const displayMedia = moveHeroFirst(mediaItems, strongPortraitIndex);

    return {
      layout: "portrait-hero",
      displayMedia,
      heroId: displayMedia[0]?.id || null,
      visibleLimit: mediaCount >= 6 ? 5 : 6,
    };
  }

  return {
    layout: getDefaultLayoutClassName(mediaCount),
    displayMedia: mediaItems,
    heroId: mediaCount === 3 ? mediaItems[0]?.id || null : null,
    visibleLimit: 6,
  };
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
      const fallbackDimensions = getFallbackDimensions(mediaType);
      const width =
        typeof media === "string"
          ? fallbackDimensions.width
          : getMediaWidth(media) || fallbackDimensions.width;
      const height =
        typeof media === "string"
          ? fallbackDimensions.height
          : getMediaHeight(media) || fallbackDimensions.height;
      const aspectRatio = width / height;
      const shapeFlags = getMediaShapeFlags(aspectRatio);

      return {
        id: typeof media === "string" ? src : media?.id || src,
        src,
        alt:
          typeof media === "string"
            ? `${fallbackAlt} ${index + 1}`
            : getMediaAlt(media, index, fallbackAlt),
        width,
        height,
        aspectRatio,
        ...shapeFlags,
        mediaType,
        media_type: mediaType,
        provider: typeof media === "string" ? "" : media?.provider || "",
        publicId:
          typeof media === "string"
            ? ""
            : media?.publicId || media?.cloudinary_public_id || "",
        sortOrder: getSortOrder(media, index),
        title: typeof media === "string" ? "" : media?.title || "",
        key: typeof media === "string" ? src : media?.id || src,
      };
    })
    .filter(Boolean);
}

function VideoMedia({ media, className = "" }) {
  return (
    <video
      className={`media-gallery__video ${className}`.trim()}
      src={media.src}
      controls
      preload="metadata"
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
    >
      Your browser does not support the video tag.
    </video>
  );
}

function ImageMedia({ media, single = false }) {
  const isGif = isGifMedia(media);

  return (
    <>
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

      {isGif && <span className="media-gallery__credit">GIF via GIPHY</span>}
    </>
  );
}

function MediaGalleryItem({
  media,
  isHero = false,
  isSingle = false,
  overlayCount = 0,
  onOpen,
}) {
  const canOpenLightbox = !isVideoMedia(media);
  const className = [
    "media-gallery__item",
    isHero ? "media-gallery__item--hero" : "",
    isGifMedia(media) ? "media-gallery__item--gif" : "",
    overlayCount > 0 ? "media-gallery__item--has-overlay" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const mediaContent = isVideoMedia(media) ? (
    <VideoMedia media={media} />
  ) : (
    <ImageMedia media={media} single={isSingle} />
  );

  if (!canOpenLightbox) {
    return (
      <figure className={className}>
        {mediaContent}
        {overlayCount > 0 && (
          <span className="media-gallery__overflow-count">
            +{overlayCount}
          </span>
        )}
      </figure>
    );
  }

  return (
    <button
      type="button"
      className={`media-gallery__button ${className}`}
      onClick={onOpen}
      aria-label="Open media full size"
    >
      {mediaContent}
      {overlayCount > 0 && (
        <span className="media-gallery__overflow-count">+{overlayCount}</span>
      )}
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
      return !isVideoMedia(media);
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

  const galleryLayout = pickGalleryLayout(mediaItems);
  const visibleMedia = galleryLayout.displayMedia.slice(
    0,
    galleryLayout.visibleLimit,
  );
  const hiddenMediaCount = Math.max(mediaItems.length - visibleMedia.length, 0);
  const galleryClassName = [
    "media-gallery",
    `media-gallery--${galleryLayout.layout}`,
    `media-gallery--visible-${visibleMedia.length}`,
  ].join(" ");

  return (
    <>
      <div className={galleryClassName}>
        {visibleMedia.map((media, mediaIndex) => {
          const lightboxIndex = imageItems.findIndex((item) => {
            return item.src === media.src;
          });

          return (
            <MediaGalleryItem
              key={media.id || media.src}
              media={media}
              isHero={media.id === galleryLayout.heroId}
              isSingle={mediaItems.length === 1}
              overlayCount={
                mediaIndex === visibleMedia.length - 1 ? hiddenMediaCount : 0
              }
              onOpen={() => setIndex(lightboxIndex)}
            />
          );
        })}
      </div>

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
    </>
  );
}
