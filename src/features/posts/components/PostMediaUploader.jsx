"use client";

import { useState } from "react";

import { validatePostMediaFiles } from "@/features/media/mediaValidation";

export default function PostMediaUploader({ onFilesChange }) {
  const [error, setError] = useState("");

  function handleFilesChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    setError("");

    if (!selectedFiles.length) {
      return;
    }

    const validation = validatePostMediaFiles(selectedFiles);

    if (!validation.isValid) {
      setError(validation.errors[0]);
      event.target.value = "";
      return;
    }

    onFilesChange?.(validation.files);
    event.target.value = "";
  }

  return (
    <section className="post-media-uploader">
      <label className="post-media-uploader__label" htmlFor="post-media">
        Add photos/videos
      </label>

      <input
        id="post-media"
        className="post-media-uploader__input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFilesChange}
      />

      {error && <p className="post-media-uploader__error">{error}</p>}
    </section>
  );
}
