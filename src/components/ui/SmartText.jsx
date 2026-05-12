import Link from "next/link";
import { normalizeUrl } from "@/lib/urlUtils";

const URL_REGEX =
  /((https?:\/\/|www\.)[^\s<]+|(?:youtube\.com|youtu\.be)\/[^\s<]+)/gi;

const MENTION_REGEX = /(^|[\s([{])@([a-zA-Z0-9_-]{2,30})\b/g;

function getDisplayUrl(value, maxLength = 48) {
  const normalizedUrl = normalizeUrl(value);

  if (!normalizedUrl) return value;

  try {
    const url = new URL(normalizedUrl);
    const cleanDisplay = `${url.hostname}${url.pathname}`;

    if (cleanDisplay.length <= maxLength) {
      return cleanDisplay;
    }

    return `${cleanDisplay.slice(0, maxLength - 1)}…`;
  } catch {
    if (value.length <= maxLength) return value;

    return `${value.slice(0, maxLength - 1)}…`;
  }
}

function splitTrailingPunctuation(value) {
  let url = value;
  let trailing = "";

  while (/[.,!?;:)]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

function splitTextByUrls(text) {
  if (!text || typeof text !== "string") return [];

  const parts = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const rawValue = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, index),
      });
    }

    const { url, trailing } = splitTrailingPunctuation(rawValue);

    parts.push({
      type: "url",
      value: url,
    });

    if (trailing) {
      parts.push({
        type: "text",
        value: trailing,
      });
    }

    lastIndex = index + rawValue.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

function getYouTubeVideoId(value) {
  if (!value || typeof value !== "string") return null;

  const url = normalizeUrl(value);

  if (!url) return null;

  const patterns = [
    /youtube\.com\/watch\?v=([^&\s]+)/,
    /youtu\.be\/([^?\s]+)/,
    /youtube\.com\/shorts\/([^?\s]+)/,
    /youtube\.com\/embed\/([^?\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function YouTubeEmbed({ url }) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) return null;

  return (
    <div className="smart-text__youtube">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

function buildMentionMap(mentionProfiles = []) {
  return new Map(
    mentionProfiles
      .filter((profile) => profile?.username && profile?.id)
      .map((profile) => [profile.username.toLowerCase(), profile])
  );
}

function renderTextWithMentions(text, mentionMap, keyPrefix) {
  if (!text) return null;

  const pieces = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_REGEX)) {
    const fullMatch = match[0];
    const prefix = match[1] || "";
    const username = match[2];
    const matchIndex = match.index ?? 0;

    const mentionStart = matchIndex + prefix.length;
    const mentionEnd = mentionStart + username.length + 1;

    if (matchIndex > lastIndex) {
      pieces.push(text.slice(lastIndex, matchIndex));
    }

    if (prefix) {
      pieces.push(prefix);
    }

    const profile = mentionMap.get(username.toLowerCase());

    if (profile) {
      pieces.push(
        <Link
          key={`${keyPrefix}-mention-${mentionStart}`}
          href={`/profiles/${profile.id}`}
          className="smart-text__mention"
        >
          @{username}
        </Link>
      );
    } else {
      pieces.push(`@${username}`);
    }

    lastIndex = mentionEnd;

    // Avoid unused variable lint whining if your setup is cranky.
    void fullMatch;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return pieces.map((piece, index) => {
    if (typeof piece === "string") {
      return <span key={`${keyPrefix}-text-${index}`}>{piece}</span>;
    }

    return piece;
  });
}

export default function SmartText({
  text,
  className = "",
  mentionProfiles = [],
}) {
  const parts = splitTextByUrls(text);
  const mentionMap = buildMentionMap(mentionProfiles);

  if (!parts.length) return null;

  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return renderTextWithMentions(
            part.value,
            mentionMap,
            `part-${index}`
          );
        }

        const href = normalizeUrl(part.value);

        if (!href) {
          return <span key={index}>{part.value}</span>;
        }

        const youtubeVideoId = getYouTubeVideoId(href);

        if (youtubeVideoId) {
          return <YouTubeEmbed key={index} url={href} />;
        }

        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="smart-text__link"
            title={href}
          >
            {getDisplayUrl(part.value)}
          </a>
        );
      })}
    </div>
  );
}