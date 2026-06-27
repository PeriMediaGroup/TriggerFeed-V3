"use client";

import { Camera, ImagePlus, Upload, Video } from "lucide-react";

export default function MediaPicker({ onAddMedia }) {
  function handleChange(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    onAddMedia(files);

    // Allows selecting the same file again later.
    event.target.value = "";
  }

  return (
    <div className="create-post__media-picker">
      <label className="create-post__media-label create-post__media-label--desktop">
        <span>Add photos/videos</span>

        <input
          className="create-post__media-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
        />
      </label>

      <div className="create-post__media-actions" aria-label="Add media">
        <label className="create-post__media-action">
          <ImagePlus size={18} strokeWidth={2} aria-hidden="true" />
          <span>Upload photo</span>
          <input
            className="create-post__media-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleChange}
          />
        </label>

        <label className="create-post__media-action">
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
          <span>Take photo</span>
          <input
            className="create-post__media-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleChange}
          />
        </label>

        <label className="create-post__media-action">
          <Upload size={18} strokeWidth={2} aria-hidden="true" />
          <span>Upload video</span>
          <input
            className="create-post__media-input"
            type="file"
            accept="video/*"
            onChange={handleChange}
          />
        </label>

        <label className="create-post__media-action">
          <Video size={18} strokeWidth={2} aria-hidden="true" />
          <span>Record video</span>
          <input
            className="create-post__media-input"
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleChange}
          />
        </label>
      </div>
    </div>
  );
}
