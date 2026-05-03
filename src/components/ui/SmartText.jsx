import { normalizeUrl } from "@/lib/urlUtils";

const URL_REGEX =
  /((https?:\/\/|www\.)[^\s<]+|(?:youtube\.com|youtu\.be)\/[^\s<]+)/gi;

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

export default function SmartText({ text, className = "" }) {
  const parts = splitTextByUrls(text);

  if (!parts.length) return null;

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>;
        }

        const href = normalizeUrl(part.value);

        if (!href) {
          return <span key={index}>{part.value}</span>;
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
    </span>
  );
}
