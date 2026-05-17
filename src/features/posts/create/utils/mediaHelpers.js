export function createMediaItemsFromFiles(files) {
  return Array.from(files || []).map((file) => ({
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

export function revokeMediaPreview(mediaItem) {
  if (mediaItem?.previewUrl) {
    URL.revokeObjectURL(mediaItem.previewUrl);
  }
}

export function revokeMediaPreviews(mediaItems = []) {
  mediaItems.forEach((mediaItem) => {
    revokeMediaPreview(mediaItem);
  });
}