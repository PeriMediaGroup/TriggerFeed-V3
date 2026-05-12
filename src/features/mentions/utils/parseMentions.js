const MENTION_REGEX = /(^|[\s([{])@([a-zA-Z0-9_-]{2,30})\b/g;

export function parseMentionUsernames(text = "") {
  if (!text || typeof text !== "string") return [];

  const matches = new Set();
  let match;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const username = match[2]?.trim().toLowerCase();

    if (username) {
      matches.add(username);
    }
  }

  return Array.from(matches);
}