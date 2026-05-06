"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { validatePostImageFiles } from "@/features/media/mediaValidation";

export default function PostMediaUploader({ onFilesChange }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [errors, setErrors] = useState([]);

  const previewsRef = useRef([]);

  function revokePreviews(previewsToRevoke) {
    previewsToRevoke.forEach((preview) => {
      URL.revokeObjectURL(preview.url);
    });
  }

  function setFilesWithPreviews(files) {
    revokePreviews(previewsRef.current);

    const nextPreviews = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    previewsRef.current = nextPreviews;

    setSelectedFiles(files);
    setPreviews(nextPreviews);
    onFilesChange(files);
  }

  useEffect(() => {
    return () => {
      revokePreviews(previewsRef.current);
    };
  }, []);

  function handleFileChange(event) {
    const validation = validatePostImageFiles(event.target.files);

    if (!validation.isValid) {
      setErrors(validation.errors);
      setFilesWithPreviews([]);
      event.target.value = "";
      return;
    }

    setErrors([]);
    setFilesWithPreviews(validation.files);
  }

  function handleRemoveFile(indexToRemove) {
    const nextFiles = selectedFiles.filter(
      (_, index) => index !== indexToRemove,
    );

    setFilesWithPreviews(nextFiles);
  }

  return (
    <div className="post-media-uploader">
      <label className="post-media-uploader__label">
        Add images
        <input
          className="post-media-uploader__input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
        />
      </label>

      {errors.length > 0 && (
        <div className="post-media-uploader__errors">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <div className="post-media-uploader__preview-grid">
          {previews.map((preview, index) => (
            <div className="post-media-uploader__preview" key={preview.url}>
              <div className="post-media-uploader__preview-image">
                <Image
                  src={preview.url}
                  alt={preview.name}
                  fill
                  sizes="(max-width: 700px) 50vw, 300px"
                  unoptimized
                />
              </div>

              <button
                type="button"
                className="post-media-uploader__remove"
                onClick={() => handleRemoveFile(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
