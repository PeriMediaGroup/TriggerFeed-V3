import { POST_MEDIA_LIMITS } from "./mediaConstants";
import { getMediaTypeFromFile } from "./mediaMetadata";

export function validatePostMediaFiles(files) {
  const fileList = Array.from(files || []);
  const errors = [];

  const imageFiles = fileList.filter((file) => {
    return getMediaTypeFromFile(file) === "image";
  });

  const videoFiles = fileList.filter((file) => {
    return getMediaTypeFromFile(file) === "video";
  });

  if (fileList.length > POST_MEDIA_LIMITS.maxTotalFiles) {
    errors.push(
      `You can upload up to ${POST_MEDIA_LIMITS.maxTotalFiles} media files.`,
    );
  }

  if (imageFiles.length > POST_MEDIA_LIMITS.maxImageFiles) {
    errors.push(
      `You can upload up to ${POST_MEDIA_LIMITS.maxImageFiles} images.`,
    );
  }

  if (videoFiles.length > POST_MEDIA_LIMITS.maxVideoFiles) {
    errors.push(
      `You can upload up to ${POST_MEDIA_LIMITS.maxVideoFiles} video.`,
    );
  }

  if (imageFiles.length > 0 && videoFiles.length > 0) {
    errors.push("For now, upload either images or one video, not both.");
  }

  fileList.forEach((file) => {
    const mediaType = getMediaTypeFromFile(file);

    if (mediaType === "image") {
      if (!POST_MEDIA_LIMITS.allowedImageMimeTypes.includes(file.type)) {
        errors.push(`${file.name} is not a supported image type.`);
      }

      if (file.size > POST_MEDIA_LIMITS.maxImageSizeBytes) {
        errors.push(`${file.name} is too large. Max image size is 5MB.`);
      }

      return;
    }

    if (mediaType === "video") {
      if (!POST_MEDIA_LIMITS.allowedVideoMimeTypes.includes(file.type)) {
        errors.push(`${file.name} is not a supported video type.`);
      }

      if (file.size > POST_MEDIA_LIMITS.maxVideoSizeBytes) {
        errors.push(`${file.name} is too large. Max video size is 75MB.`);
      }

      return;
    }

    errors.push(`${file.name} is not a supported media type.`);
  });

  return {
    isValid: errors.length === 0,
    errors,
    files: fileList,
    imageFiles,
    videoFiles,
  };
}

// Temporary backwards compatibility for old imports.
// Remove once all callers use validatePostMediaFiles.
export function validatePostImageFiles(files) {
  return validatePostMediaFiles(files);
}