const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(`${value || ""}`);
}

export function getPostRouteIdentifier(post) {
  if (!post) {
    return "";
  }

  if (typeof post === "string") {
    return post;
  }

  return post.slug || post.id || post.post_id || "";
}

export function getPostPath(post, { hash = "" } = {}) {
  const identifier = getPostRouteIdentifier(post);
  const suffix = hash ? `#${hash.replace(/^#/, "")}` : "";

  return identifier ? `/posts/${identifier}${suffix}` : "/posts";
}

export function getPostEditPath(post) {
  const identifier = getPostRouteIdentifier(post);

  return identifier ? `/posts/${identifier}/edit` : "/posts";
}

export function getAbsolutePostUrl(post, siteUrl) {
  return new URL(getPostPath(post), siteUrl).toString();
}
