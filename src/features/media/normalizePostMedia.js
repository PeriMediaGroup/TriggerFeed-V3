export function normalizePostMedia(mediaRows = []) {
  if (!Array.isArray(mediaRows)) {
    return [];
  }

  return mediaRows
    .map((item) => {
      const src =
        item?.cloudinary_secure_url ||
        item?.cloudinary_url ||
        item?.external_url ||
        item?.thumbnail_url ||
        "";

      if (!src) {
        return null;
      }

      const sortOrder = item?.sort_order ?? item?.display_order ?? 0;

      return {
        id: item.id,
        src,
        alt: item.alt_text || item.title || "",
        width: item.width || 1200,
        height: item.height || 900,
        mediaType: item.media_type,
        media_type: item.media_type,
        provider: item.provider,
        publicId: item.cloudinary_public_id,
        sortOrder,
        sort_order: sortOrder,
        display_order: item.display_order ?? sortOrder,
        title: item.title || "",
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      return (left.sortOrder || 0) - (right.sortOrder || 0);
    });
}
