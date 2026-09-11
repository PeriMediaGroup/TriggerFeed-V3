import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getAbsolutePostUrl } from "@/features/posts/lib/postUrls";

const DESCRIPTION_MAX_LENGTH = 158;

export function stripMarkup(value = "") {
  return `${value}`
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function normalizeSeoText(value = "") {
  return stripMarkup(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateDescription(value, maxLength = DESCRIPTION_MAX_LENGTH) {
  const text = normalizeSeoText(value);

  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength + 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeText = lastSpace > 80 ? clipped.slice(0, lastSpace) : text.slice(0, maxLength);

  return `${safeText.trim().replace(/[.,;:!?-]+$/, "")}...`;
}

export function getPostDescription(post) {
  return truncateDescription(post?.body || "") || SITE_DESCRIPTION;
}

export function getFirstPostImage(post) {
  const media = post?.media || post?.post_media || [];
  const firstImage = Array.isArray(media)
    ? media.find((item) => {
        const mediaType = `${item?.mediaType || item?.media_type || "image"}`.toLowerCase();
        const src =
          item?.src ||
          item?.cloudinary_secure_url ||
          item?.cloudinary_url ||
          item?.external_url ||
          item?.thumbnail_url ||
          "";

        return src && mediaType !== "video";
      })
    : null;

  if (!firstImage) {
    return null;
  }

  return (
    firstImage.src ||
    firstImage.cloudinary_secure_url ||
    firstImage.cloudinary_url ||
    firstImage.external_url ||
    firstImage.thumbnail_url ||
    null
  );
}

export function isIndexablePost(post) {
  return Boolean(
    post &&
      post.slug &&
      post.is_deleted !== true &&
      post.visibility === "public" &&
      normalizeSeoText(post.title).length > 0,
  );
}

export function getPostJsonLd(post) {
  if (!isIndexablePost(post)) {
    return null;
  }

  const canonicalUrl = getAbsolutePostUrl(post, SITE_URL);
  const image = getFirstPostImage(post);
  const authorName =
    post.author?.display_name ||
    [post.author?.first_name, post.author?.last_name].filter(Boolean).join(" ") ||
    post.author?.username ||
    SITE_NAME;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: normalizeSeoText(post.title),
    text: normalizeSeoText(post.body || ""),
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    url: canonicalUrl,
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  };

  if (post.author?.id && post.author?.is_deleted !== true) {
    jsonLd.author.url = new URL(`/profiles/${post.author.id}`, SITE_URL).toString();
  }

  if (image) {
    jsonLd.image = [image];
  }

  if (Number(post.interaction_count) > 0) {
    jsonLd.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: Number(post.interaction_count),
    };
  }

  return jsonLd;
}

export function stringifyJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
