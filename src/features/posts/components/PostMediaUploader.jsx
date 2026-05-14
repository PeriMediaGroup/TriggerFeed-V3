"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_FILES = 4;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_TOTAL_UPLOAD_SIZE_MB = 20;
const MAX_TOTAL_UPLOAD_SIZE_BYTES = MAX_TOTAL_UPLOAD_SIZE_MB * 1024 * 1024;

export default function PostMediaUploader({ onFilesChange }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  const previews = useMemo(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [previews]);

  function handleFilesChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    setError("");

    if (!selectedFiles.length) {
      setFiles([]);
      onFilesChange?.([]);
      return;
    }

    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length !== selectedFiles.length) {
      setError("Only image files are allowed.");
      event.target.value = "";
      return;
    }

    if (imageFiles.length > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} images.`);
      event.target.value = "";
      return;
    }

    const oversizedFile = imageFiles.find(
      (file) => file.size > MAX_FILE_SIZE_BYTES,
    );

    if (oversizedFile) {
      setError(`Images must be under ${MAX_FILE_SIZE_MB}MB each.`);
      event.target.value = "";
      return;
    }

    const totalUploadSize = imageFiles.reduce(
      (total, file) => total + file.size,
      0,
    );

    if (totalUploadSize > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
      setError(`Total upload size must be under ${MAX_TOTAL_UPLOAD_SIZE_MB}MB.`);
      event.target.value = "";
      return;
    }

    setFiles(imageFiles);
    onFilesChange?.(imageFiles);
  }

  function handleRemoveFile(fileToRemove) {
    const nextFiles = files.filter((file) => file !== fileToRemove);

    setFiles(nextFiles);
    onFilesChange?.(nextFiles);
  }

  return (
    <section className="post-media-uploader">
      <label className="post-media-uploader__label" htmlFor="post-media">
        Add images
      </label>

      <input
        id="post-media"
        className="post-media-uploader__input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
      />

      {error && <p className="post-media-uploader__error">{error}</p>}

      {previews.length > 0 && (
        <div className="post-media-uploader__preview-grid">
          {previews.map(({ file, url }) => (
            <div className="post-media-uploader__preview" key={url}>
              <img
                src={url}
                alt={file.name}
                className="post-media-uploader__preview-image"
              />

              <button
                type="button"
                className="post-media-uploader__remove"
                onClick={() => handleRemoveFile(file)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}