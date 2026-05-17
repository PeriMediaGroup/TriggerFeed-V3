"use client";

import { useEffect, useMemo, useState } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";

const GIF_LIMIT = 12;

export default function CreatePostGifPicker({
  selectedGif,
  onSelectGif,
  onRemoveGif,
  onClose,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");

  const gf = useMemo(() => {
    return new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY);
  }, []);

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

  async function loadGifs({ nextOffset = 0, append = false } = {}) {
    setIsLoading(true);
    setStatus("");

    try {
      const trimmedSearchTerm = searchTerm.trim();

      const result = trimmedSearchTerm
        ? await gf.search(trimmedSearchTerm, {
            offset: nextOffset,
            limit: GIF_LIMIT,
            rating: "pg-13",
          })
        : await gf.trending({
            offset: nextOffset,
            limit: GIF_LIMIT,
            rating: "pg-13",
          });

      const nextGifs = result.data || [];

      setGifs((currentGifs) => {
        return append ? [...currentGifs, ...nextGifs] : nextGifs;
      });

      setOffset(nextOffset + GIF_LIMIT);
    } catch (error) {
      console.error("GIPHY LOAD ERROR:", error);
      setStatus("Could not load GIFs.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearch(event) {
    setOffset(0);
    loadGifs({ nextOffset: 0, append: false });
  }

  function handleLoadMore() {
    loadGifs({ nextOffset: offset, append: true });
  }

  useEffect(() => {
    loadGifs({ nextOffset: 0, append: false });
    // Intentionally only load initial trending GIFs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="create-post__gif-picker">
      <div className="create-post__gif-header">
        <div onSubmit={handleSearch} className="create-post__gif-search-form">
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="create-post__gif-search"
          />

          <button type="submit" disabled={isLoading}>
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
        <div className="create-post__selected-gif">
          <img
            src={selectedGif.previewUrl || selectedGif.url}
            alt={selectedGif.title || "Selected GIF"}
          />

          <button type="button" onClick={onRemoveGif}>
            Remove GIF
          </button>
        </div>
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

      <button
        type="button"
        className="create-post__gif-more"
        onClick={handleLoadMore}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "More GIFs"}
      </button>
    </section>
  );
}
