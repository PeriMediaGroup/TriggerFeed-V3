"use client";

export default function CreatePostGifPicker({
  selectedGif,
  onSelectGif,
  onRemoveGif,
  onClose,
  searchTerm,
  onSearchTermChange,
  gifs,
  isLoading,
  status,
  onSearch,
  onLoadMore,
}) {
  function normalizeGif(gif) {
    return {
      id: gif.id,
      title: gif.title || "",
      url: gif.images?.original?.url || gif.images?.fixed_height?.url,
      previewUrl:
        gif.images?.fixed_width_small?.url ||
        gif.images?.fixed_height_small?.url ||
        gif.images?.fixed_height?.url,
      giphyUrl: gif.url || "",
      username: gif.username || "",
      sourcePostUrl: gif.source_post_url || "",
      source: "giphy",
    };
  }

  return (
    <section className="create-post__gif-picker">
      <div className="create-post__gif-header">
        <div className="create-post__gif-search-form">
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
            className="create-post__gif-search"
          />

          <button type="button" onClick={onSearch} disabled={isLoading}>
            Search
          </button>
        </div>

        {onClose && (
          <button type="button" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {selectedGif && (
        <div className="create-post__gif-selected">
          <img
            src={selectedGif.previewUrl || selectedGif.url}
            alt={selectedGif.title || "Selected GIF"}
          />

          <button type="button" onClick={onRemoveGif}>
            Remove GIF
          </button>
        </div>
      )}

      {isLoading && gifs.length === 0 && (
        <p className="create-post__gif-status">Loading GIFs...</p>
      )}

      <div className="create-post__gif-grid">
        {gifs.map((gif) => {
          const normalizedGif = normalizeGif(gif);

          return (
            <button
              key={gif.id}
              type="button"
              className="create-post__gif-option"
              onClick={() => onSelectGif(normalizedGif)}
            >
              <img
                src={normalizedGif.previewUrl}
                alt={normalizedGif.title || "GIF"}
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {status && <p className="create-post__gif-status">{status}</p>}

      {gifs.length > 0 && (
        <button
          type="button"
          className="create-post__gif-more"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "More GIFs"}
        </button>
      )}
    </section>
  );
}
