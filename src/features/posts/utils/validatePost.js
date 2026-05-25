// src/features/posts/utils/validatePost.js

const VALID_VISIBILITIES = ["public"];

export function validatePostInput({ title, body, visibility }) {
  const errors = {};

  const cleanTitle = title?.trim() || "";
  const cleanBody = body?.trim() || "";
  const cleanVisibility = visibility || "public";

  const hasTitle = cleanTitle.length > 0;
  const hasBody = cleanBody.length > 0;

  if (!hasTitle && !hasBody) {
    errors.content = "Add a headline or content before posting.";
  }

  if (cleanTitle.length > 120) {
    errors.title = "Post title must be 120 characters or less.";
  }

  if (cleanBody.length > 5000) {
    errors.body = "Post content must be 5000 characters or less.";
  }

  if (!VALID_VISIBILITIES.includes(cleanVisibility)) {
    errors.visibility = "Invalid post visibility.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      title: hasTitle ? cleanTitle : null,
      body: hasBody ? cleanBody : null,
      visibility: cleanVisibility,
    },
  };
}

export function getFirstPostError(errors = {}) {
  return (
    errors.content ||
    errors.title ||
    errors.body ||
    errors.visibility ||
    "Please fix the post errors."
  );
}