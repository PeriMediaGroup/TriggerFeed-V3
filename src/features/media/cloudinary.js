import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadProfileImage({ file, userId, imageType }) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!["avatar", "banner"].includes(imageType)) {
    throw new Error("Invalid profile image type");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image uploads are allowed");
  }

  const maxSize = imageType === "avatar" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      imageType === "avatar"
        ? "Avatar image must be 2MB or smaller"
        : "Banner image must be 5MB or smaller",
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const folder = `triggerfeed-v3/profiles/${userId}/${imageType}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: "current",
        overwrite: true,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

export async function uploadPostImage({ file, folder }) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image uploads are allowed");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    uploadStream.end(buffer);
  });
}

export async function deleteCloudinaryImage(publicId) {
  if (!publicId) {
    return null;
  }

  return cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });
}