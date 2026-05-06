export const POST_IMAGE_LIMITS = {
  maxFiles: 4,
  maxFileSizeBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};

export function validatePostImageFiles(files) {
  const fileList = Array.from(files || []);
  const errors = [];

  if (fileList.length > POST_IMAGE_LIMITS.maxFiles) {
    errors.push(`You can upload up to ${POST_IMAGE_LIMITS.maxFiles} images.`);
  }

  fileList.forEach((file) => {
    if (!POST_IMAGE_LIMITS.allowedMimeTypes.includes(file.type)) {
      errors.push(`${file.name} is not a supported image type.`);
    }

    if (file.size > POST_IMAGE_LIMITS.maxFileSizeBytes) {
      errors.push(`${file.name} is too large. Max image size is 5MB.`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    files: fileList,
  };
}