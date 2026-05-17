"use client";

export default function CreatePostToolbar({ activeTool, onSelectTool }) {
  function toggleTool(toolName) {
    onSelectTool(activeTool === toolName ? null : toolName);
  }

  return (
    <div className="create-post__toolbar" aria-label="Create post tools">
      <button
        type="button"
        className="create-post__tool-button"
        onClick={() => toggleTool("media")}
      >
        Photo/Video
      </button>

      <button
        type="button"
        className="create-post__tool-button"
        onClick={() => toggleTool("emoji")}
      >
        Emoji
      </button>

      <button
        type="button"
        className="create-post__tool-button"
        onClick={() => toggleTool("gif")}
      >
        GIF
      </button>

      <button
        type="button"
        className="create-post__tool-button"
        onClick={() => toggleTool("poll")}
      >
        Poll
      </button>
    </div>
  );
}