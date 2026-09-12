import SmartText from "@/components/ui/SmartText";
import {
  looksLikeRichPostHtml,
  sanitizeRichPostHtml,
} from "@/features/posts/lib/richText";

const MENTION_REGEX = /(^|[\s([{])@([a-zA-Z0-9_-]{2,30})\b/g;

function escapeHtml(value = "") {
  return `${value}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMentionMap(mentionProfiles = []) {
  return new Map(
    mentionProfiles
      .filter((profile) => profile?.username && profile?.id)
      .map((profile) => [profile.username.toLowerCase(), profile]),
  );
}

function linkMentionsInTextChunk(text, mentionMap) {
  return text.replace(MENTION_REGEX, (match, prefix, username) => {
    const profile = mentionMap.get(username.toLowerCase());

    if (!profile) {
      return match;
    }

    return `${prefix}<a href="/profiles/${escapeHtml(
      profile.id,
    )}" class="smart-text__mention">@${escapeHtml(
      username,
    )}</a>`;
  });
}

function linkMentionsInSanitizedHtml(html, mentionProfiles = []) {
  const mentionMap = buildMentionMap(mentionProfiles);

  if (!mentionMap.size) {
    return html;
  }

  return html
    .split(/(<[^>]+>)/g)
    .map((chunk) => {
      if (!chunk || chunk.startsWith("<")) {
        return chunk;
      }

      return linkMentionsInTextChunk(chunk, mentionMap);
    })
    .join("");
}

export default function RichPostContent({
  content,
  className = "rich-post-content",
  mentionProfiles = [],
}) {
  if (!content) {
    return null;
  }

  if (!looksLikeRichPostHtml(content)) {
    return (
      <SmartText
        text={content}
        className={`${className} rich-post-content--plain`}
        mentionProfiles={mentionProfiles}
      />
    );
  }

  const sanitizedHtml = linkMentionsInSanitizedHtml(
    sanitizeRichPostHtml(content),
    mentionProfiles,
  );

  if (!sanitizedHtml) {
    return null;
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
