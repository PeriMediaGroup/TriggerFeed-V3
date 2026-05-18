import { POST_MEDIA_TYPES } from "./mediaConstants";

export function getMediaTypeFromFile(file) {
  if (file?.type?.startsWith("image/")) {
    return POST_MEDIA_TYPES.image;
  }

  if (file?.type?.startsWith("video/")) {
    return POST_MEDIA_TYPES.video;
  }

  return "unknown";
}

export function getCloudinaryResourceTypeFromMediaType(mediaType) {
  if (mediaType === POST_MEDIA_TYPES.video) {
    return "video";
  }

  return "image";
}