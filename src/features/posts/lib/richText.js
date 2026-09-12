import sanitizeHtml from "sanitize-html";

export const RICH_POST_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "a",
  "ul",
  "ol",
  "li",
];

const RICH_TEXT_EMPTY_HTML = "<p></p>";

function escapeHtml(value = "") {
  return `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafePostHref(value = "") {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizePostHref(value = "") {
  const href = `${value}`.trim();

  if (!href) {
    return "";
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  return `https://${href}`;
}

function normalizeRichTextInput(value = "") {
  const rawValue = `${value || ""}`;

  if (!rawValue.trim()) {
    return "";
  }

  return rawValue;
}

export function looksLikeRichPostHtml(value = "") {
  return /<\/?(p|br|strong|em|a|ul|ol|li)\b/i.test(`${value || ""}`);
}

export function plainTextToRichPostHtml(value = "") {
  const text = `${value || ""}`.replace(/\r\n?/g, "\n");

  if (!text.trim()) {
    return RICH_TEXT_EMPTY_HTML;
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escapedParagraph = escapeHtml(paragraph).replace(/\n/g, "<br>");

      return `<p>${escapedParagraph}</p>`;
    })
    .join("");
}

// Stored post bodies may now contain sanitized HTML for web and future Android rendering.
// Supported features: paragraphs, line breaks, bold, italic, http(s) links, bullet lists, and numbered lists.
export function sanitizeRichPostHtml(value = "") {
  const html = normalizeRichTextInput(value);

  if (!html) {
    return "";
  }

  return sanitizeHtml(html, {
    allowedTags: RICH_POST_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "rel", "target"],
    },
    allowedSchemes: ["http", "https"],
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    parser: {
      lowerCaseTags: true,
    },
    transformTags: {
      b: "strong",
      i: "em",
      a: (tagName, attribs) => {
        const href = normalizePostHref(attribs.href);

        if (!href || !isSafePostHref(href)) {
          return {
            tagName,
            attribs: {},
          };
        }

        return {
          tagName,
          attribs: {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  }).trim();
}

export function normalizePostBodyForStorage(value = "") {
  const html = looksLikeRichPostHtml(value)
    ? value
    : plainTextToRichPostHtml(value);
  const sanitizedHtml = sanitizeRichPostHtml(html);
  const text = richPostHtmlToPlainText(sanitizedHtml);

  return text ? sanitizedHtml : "";
}

export function normalizePostBodyForEditor(value = "") {
  if (!value) {
    return RICH_TEXT_EMPTY_HTML;
  }

  return looksLikeRichPostHtml(value)
    ? sanitizeRichPostHtml(value) || RICH_TEXT_EMPTY_HTML
    : plainTextToRichPostHtml(value);
}

export function richPostHtmlToPlainText(value = "") {
  const html = looksLikeRichPostHtml(value)
    ? sanitizeRichPostHtml(value)
    : escapeHtml(value);

  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter: (text) => text.replace(/\u00a0/g, " "),
  })
    .replace(/\s+/g, " ")
    .trim();
}

export function getRichPostVisibleTextLength(value = "") {
  return richPostHtmlToPlainText(value).length;
}

export function getPlainPostPreview(value = "", maxLength = 140) {
  const text = richPostHtmlToPlainText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}
