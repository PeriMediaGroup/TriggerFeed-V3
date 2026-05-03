export function normalizeUrl(input) {
  if (!input || typeof input !== "string") return null;

  let value = input.trim();

  // If user types triggerfeed.com instead of https://triggerfeed.com
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);

    // Only allow normal web links
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}