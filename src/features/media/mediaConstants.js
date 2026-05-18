export const POST_MEDIA_LIMITS = {
  maxTotalFiles: 4,
  maxImageFiles: 4,
  maxVideoFiles: 1,

  maxImageSizeBytes: 5 * 1024 * 1024,
  maxVideoSizeBytes: 75 * 1024 * 1024,

  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
};

export const POST_MEDIA_TYPES = {
  image: "image",
  video: "video",
  gif: "gif",
};

export const POST_MEDIA_PROVIDERS = {
  cloudinary: "cloudinary",
  giphy: "giphy",
};