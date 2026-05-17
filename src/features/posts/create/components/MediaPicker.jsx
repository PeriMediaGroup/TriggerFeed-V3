"use client";

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
      <label className="create-post__media-label">
        <span>Add photos/videos</span>

        <input
          className="create-post__media-input"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
        />
      </label>
    </div>
  );
}