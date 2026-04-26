// src/features/posts/utils/validatePost.js

const VALID_VISIBILITIES = ["public", "friends", "private"];

export function validatePostInput({ title, body, visibility }) {
  const errors = {};

  const cleanTitle = title?.trim() || "";
  const cleanBody = body?.trim() || "";
  const cleanVisibility = visibility || "public";

  if (!cleanTitle) {
    errors.title = "Post title is required.";
  }

  if (cleanTitle.length > 120) {
    errors.title = "Post title must be 120 characters or less.";
  }

  if (cleanBody.length > 5000) {
    errors.body = "Post body must be 5000 characters or less.";
  }

  if (!VALID_VISIBILITIES.includes(cleanVisibility)) {
    errors.visibility = "Invalid post visibility.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      title: cleanTitle,
      body: cleanBody,
      visibility: cleanVisibility,
    },
  };
}