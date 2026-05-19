import { getMediaTypeFromFile } from "./mediaMetadata";

export async function uploadFileToCloudinary({ file, postId }) {
  const mediaType = getMediaTypeFromFile(file);

  const signatureResponse = await fetch("/api/cloudinary/sign-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      postId,
      mediaType,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });

  const signaturePayload = await signatureResponse.json().catch(() => null);

  if (!signatureResponse.ok) {
    throw new Error(
      signaturePayload?.error || "Could not prepare media upload.",
    );
  }

  const cloudinaryFormData = new FormData();

  cloudinaryFormData.append("file", file);
  cloudinaryFormData.append("api_key", signaturePayload.apiKey);
  cloudinaryFormData.append("timestamp", signaturePayload.timestamp);
  cloudinaryFormData.append("signature", signaturePayload.signature);
  cloudinaryFormData.append("folder", signaturePayload.folder);
  cloudinaryFormData.append("use_filename", "true");
  cloudinaryFormData.append("unique_filename", "true");
  cloudinaryFormData.append("overwrite", "false");
  cloudinaryFormData.append("upload_preset", signaturePayload.uploadPreset);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/${signaturePayload.resourceType}/upload`;

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: cloudinaryFormData,
  });

  const uploadResult = await uploadResponse.json().catch(() => null);

  if (!uploadResponse.ok) {
    throw new Error(uploadResult?.error?.message || "Cloudinary upload failed.");
  }

  return {
    media_type: mediaType,
    provider: "cloudinary",
    cloudinary_url: uploadResult.secure_url,
    cloudinary_secure_url: uploadResult.secure_url,
    cloudinary_public_id: uploadResult.public_id,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    width: uploadResult.width || null,
    height: uploadResult.height || null,
    format: uploadResult.format || null,
    duration: uploadResult.duration || null,
    bytes: uploadResult.bytes || file.size,
    resource_type: uploadResult.resource_type || signaturePayload.resourceType,
  };
}

export async function uploadFilesToCloudinary({ files, postId, onProgress }) {
  const uploadedMedia = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    onProgress?.({
      index,
      total: files.length,
      file,
      status: "uploading",
    });

    const uploaded = await uploadFileToCloudinary({
      file,
      postId,
    });

    uploadedMedia.push({
      ...uploaded,
      sort_order: index,
      display_order: index,
    });

    onProgress?.({
      index,
      total: files.length,
      file,
      status: "uploaded",
    });
  }

  return uploadedMedia;
}