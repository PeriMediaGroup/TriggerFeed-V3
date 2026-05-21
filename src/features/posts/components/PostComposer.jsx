"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";

import MentionInput from "@/features/mentions/components/MentionInputs";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

import CreatePostToolbar from "@/features/posts/create/components/CreatePostToolbar";
import MediaPicker from "@/features/posts/create/components/MediaPicker";
import MediaPreviewGrid from "@/features/posts/create/components/MediaPreviewGrid";
import CreatePostEmojiPicker from "@/features/posts/create/components/CreatePostEmojiPicker";
import CreatePostPollBuilder from "@/features/posts/create/components/CreatePostPollBuilder";
import CreatePostGifPicker from "@/features/posts/create/components/CreatePostGifPicker";

import {
  createMediaItemsFromFiles,
  revokeMediaPreview,
  revokeMediaPreviews,
} from "@/features/posts/create/utils/mediaHelpers";

import {
  cleanPollDraft,
  createEmptyPollDraft,
} from "@/features/posts/create/utils/pollHelpers";

const GIF_LIMIT = 12;

function normalizeInitialPoll(initialPoll) {
  if (!initialPoll) {
    return null;
  }

  if (typeof initialPoll === "string") {
    try {
      return normalizeInitialPoll(JSON.parse(initialPoll));
    } catch {
      return null;
    }
  }

  const rawOptions =
    initialPoll.options ||
    initialPoll.poll_options ||
    initialPoll.pollOptions ||
    [];

  const normalizedOptions = Array.isArray(rawOptions)
    ? rawOptions.map((option) => {
        if (typeof option === "string") {
          return option;
        }

        return (
          option.text ||
          option.label ||
          option.body ||
          option.option_text ||
          option.option ||
          option.title ||
          ""
        );
      })
    : [];

  return {
    ...initialPoll,
    question:
      initialPoll.question || initialPoll.prompt || initialPoll.title || "",
    options: normalizedOptions,
  };
}

function getGifId(gif) {
  return gif?.external_id || gif?.public_id || gif?.publicId || gif?.id || "";
}

function getGifUrl(gif) {
  const gifId = getGifId(gif);

  return (
    gif?.external_url ||
    gif?.url ||
    gif?.secure_url ||
    gif?.media_url ||
    gif?.image_url ||
    gif?.images?.original?.url ||
    gif?.images?.downsized_medium?.url ||
    gif?.images?.fixed_height?.url ||
    gif?.images?.preview_gif?.url ||
    (gifId ? `https://media.giphy.com/media/${gifId}/giphy.gif` : "")
  );
}

function getGifThumbnailUrl(gif) {
  return (
    gif?.thumbnail_url ||
    gif?.preview_url ||
    gif?.previewUrl ||
    gif?.images?.fixed_width_small?.url ||
    gif?.images?.fixed_height_small?.url ||
    gif?.images?.preview_gif?.url ||
    getGifUrl(gif)
  );
}

function getGifTitle(gif) {
  return gif?.title || gif?.name || "GIPHY";
}

function normalizeInitialGif(initialGif) {
  if (!initialGif) {
    return null;
  }

  if (typeof initialGif === "string") {
    try {
      return normalizeInitialGif(JSON.parse(initialGif));
    } catch {
      return null;
    }
  }

  const gifId = getGifId(initialGif);
  const gifUrl = getGifUrl(initialGif);
  const thumbnailUrl = getGifThumbnailUrl(initialGif);

  if (!gifId && !gifUrl) {
    return initialGif;
  }

  return {
    ...initialGif,
    id: gifId,
    external_id: gifId,
    url: gifUrl,
    external_url: gifUrl,
    media_url: gifUrl,
    secure_url: gifUrl,
    previewUrl: thumbnailUrl,
    preview_url: thumbnailUrl,
    thumbnail_url: thumbnailUrl,
    title: getGifTitle(initialGif),
    source: "giphy",
    provider: "giphy",
    media_type: "gif",
    resource_type: "image",
  };
}

function normalizeGifForSubmit(gif, sortOrder = 0) {
  if (!gif) {
    return null;
  }

  const gifId = getGifId(gif);
  const gifUrl = getGifUrl(gif);
  const thumbnailUrl = getGifThumbnailUrl(gif);

  if (!gifUrl) {
    return null;
  }

  return {
    ...gif,
    id: gifId,
    external_id: gifId,
    url: gifUrl,
    external_url: gifUrl,
    media_url: gifUrl,
    secure_url: gifUrl,
    previewUrl: thumbnailUrl,
    preview_url: thumbnailUrl,
    thumbnail_url: thumbnailUrl,
    title: getGifTitle(gif),
    source: "giphy",
    provider: "giphy",
    media_type: "gif",
    resource_type: "image",
    sortOrder,
    displayOrder: sortOrder,
  };
}

function getComparableGifKey(gif) {
  if (!gif) {
    return "";
  }

  return getGifId(gif) || getGifUrl(gif);
}

function isSameGif(leftGif, rightGif) {
  const leftKey = getComparableGifKey(leftGif);
  const rightKey = getComparableGifKey(rightGif);

  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export default function PostComposer({
  mode = "create",
  initialTitle = "",
  initialBody = "",
  initialPoll = null,
  initialGif = null,
  errors = {},
  mediaErrors = [],
  status = "",
  submitStep = "",
  isPending = false,
  submitLabel = "Post",
  pendingLabel = "Posting...",
  bodyPlaceholder = "What's on your mind?",
  className = "",
  renderMediaManager,
  onSubmit,
}) {
  const normalizedInitialPoll = useMemo(
    () => normalizeInitialPoll(initialPoll),
    [initialPoll],
  );
  const normalizedInitialGif = useMemo(
    () => normalizeInitialGif(initialGif),
    [initialGif],
  );

  const [localErrors, setLocalErrors] = useState({});
  const [mediaItems, setMediaItems] = useState([]);

  const [activeTool, setActiveTool] = useState(() => {
    if (normalizedInitialPoll) {
      return "poll";
    }

    if (normalizedInitialGif) {
      return "gif";
    }

    return null;
  });

  const [title, setTitle] = useState(() => initialTitle || "");
  const [body, setBody] = useState(() => initialBody || "");
  const [poll, setPoll] = useState(() => normalizedInitialPoll);
  const [selectedGif, setSelectedGif] = useState(() => normalizedInitialGif);

  const [gifSearchTerm, setGifSearchTerm] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifOffset, setGifOffset] = useState(0);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const [gifStatus, setGifStatus] = useState("");

  const mediaItemsRef = useRef([]);

  const mergedErrors = {
    ...errors,
    ...localErrors,
  };

  const gf = useMemo(() => {
    const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

    if (!apiKey) {
      return null;
    }

    return new GiphyFetch(apiKey);
  }, []);

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);

  useEffect(() => {
    return () => {
      revokeMediaPreviews(mediaItemsRef.current);
    };
  }, []);

  async function loadGifs({ nextOffset = 0, append = false, searchTerm } = {}) {
    if (!gf) {
      setGifStatus("GIPHY is not configured.");
      return;
    }

    setIsGifLoading(true);
    setGifStatus("");

    try {
      const trimmedSearchTerm = (searchTerm ?? gifSearchTerm).trim();

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

      setGifResults((currentGifs) => {
        return append ? [...currentGifs, ...nextGifs] : nextGifs;
      });

      setGifOffset(nextOffset + GIF_LIMIT);
    } catch (error) {
      console.error("GIPHY LOAD ERROR:", error);
      setGifStatus("Could not load GIFs.");
    } finally {
      setIsGifLoading(false);
    }
  }

  function handleInsertEmoji(emoji) {
    setBody((currentBody) => `${currentBody}${emoji}`);
  }

  function handleAddMedia(files) {
    const nextMediaItems = createMediaItemsFromFiles(files);

    setMediaItems((currentItems) => [...currentItems, ...nextMediaItems]);
  }

  function handleRemoveMedia(mediaId) {
    setMediaItems((currentItems) => {
      const itemToRemove = currentItems.find((item) => item.id === mediaId);

      revokeMediaPreview(itemToRemove);

      return currentItems.filter((item) => item.id !== mediaId);
    });
  }

  function handleSelectTool(toolName) {
    if (toolName === "poll" && !poll) {
      setPoll(createEmptyPollDraft());
    }

    if (toolName === "gif" && activeTool !== "gif" && gifResults.length === 0) {
      void loadGifs({
        nextOffset: 0,
        append: false,
        searchTerm: "",
      });
    }

    setActiveTool((currentTool) => {
      return currentTool === toolName ? null : toolName;
    });
  }

  function resetComposer(form) {
    form.reset();
    setPoll(null);
    setSelectedGif(null);

    revokeMediaPreviews(mediaItemsRef.current);

    setTitle("");
    setBody("");
    setMediaItems([]);
    setActiveTool(null);
    setLocalErrors({});
    setGifSearchTerm("");
    setGifResults([]);
    setGifOffset(0);
    setGifStatus("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const cleanedPoll = cleanPollDraft(poll);

    setLocalErrors({});

    if (cleanedPoll?.error) {
      setLocalErrors({ poll: cleanedPoll.error });
      return;
    }

    if (cleanedPoll?.poll) {
      formData.set("poll", JSON.stringify(cleanedPoll.poll));
      formData.delete("remove_poll");
    } else {
      formData.delete("poll");

      if (mode === "edit" && normalizedInitialPoll) {
        formData.set("remove_poll", "true");
      } else {
        formData.delete("remove_poll");
      }
    }

    const normalizedSelectedGif = normalizeGifForSubmit(
      selectedGif,
      mediaItems.length,
    );

    if (normalizedSelectedGif) {
      if (
        mode === "edit" &&
        isSameGif(normalizedInitialGif, normalizedSelectedGif)
      ) {
        formData.delete("gif");
        formData.delete("remove_gif");
      } else {
        formData.set("gif", JSON.stringify(normalizedSelectedGif));
        formData.delete("remove_gif");
      }
    } else {
      formData.delete("gif");

      if (mode === "edit" && normalizedInitialGif) {
        formData.set("remove_gif", "true");
      } else {
        formData.delete("remove_gif");
      }
    }

    const shouldReset = await onSubmit({
      form,
      formData,
      title,
      body,
      mediaItems,
      poll,
      cleanedPoll: cleanedPoll?.poll || null,
      selectedGif: normalizedSelectedGif,
      resetComposer,
    });

    if (shouldReset) {
      resetComposer(form);
    }
  }

  const formClassName = [
    "post-form",
    "post-composer",
    `${mode}-post`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const shouldShowCustomMediaManager =
    renderMediaManager && (mode === "edit" || activeTool === "media");

  return (
    <form className={formClassName} onSubmit={handleSubmit}>
      <div className="post-form__field post-composer__field">
        <label htmlFor="title">Title</label>

        <MentionInput
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Post title"
          maxLength={120}
          required
        />

        {mergedErrors.title && (
          <p className="post-form__error">{mergedErrors.title}</p>
        )}
      </div>

      <div className="post-form__field post-composer__field">
        <label htmlFor="body">Body</label>

        <MentionTextarea
          id="body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={bodyPlaceholder}
          rows={5}
          maxLength={5000}
        />

        {mergedErrors.body && (
          <p className="post-form__error">{mergedErrors.body}</p>
        )}
      </div>

      <input type="hidden" name="visibility" value="public" />

      {mergedErrors.visibility && (
        <p className="post-form__error">{mergedErrors.visibility}</p>
      )}

      <CreatePostToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
      />

      {shouldShowCustomMediaManager &&
        renderMediaManager({
          mediaItems,
          onAddMedia: handleAddMedia,
          onRemoveMedia: handleRemoveMedia,
        })}

      {activeTool === "media" && !renderMediaManager && (
        <MediaPicker onAddMedia={handleAddMedia} />
      )}

      {activeTool === "emoji" && (
        <CreatePostEmojiPicker onSelectEmoji={handleInsertEmoji} />
      )}

      {activeTool === "poll" && (
        <CreatePostPollBuilder
          poll={poll}
          onChange={setPoll}
          onRemove={() => {
            setPoll(null);
            setActiveTool(null);
          }}
        />
      )}

      {activeTool === "gif" && (
        <CreatePostGifPicker
          selectedGif={selectedGif}
          onSelectGif={setSelectedGif}
          onRemoveGif={() => setSelectedGif(null)}
          onClose={() => setActiveTool(null)}
          searchTerm={gifSearchTerm}
          onSearchTermChange={setGifSearchTerm}
          gifs={gifResults}
          isLoading={isGifLoading}
          status={gifStatus}
          onSearch={() => {
            setGifOffset(0);
            void loadGifs({
              nextOffset: 0,
              append: false,
              searchTerm: gifSearchTerm,
            });
          }}
          onLoadMore={() => {
            void loadGifs({
              nextOffset: gifOffset,
              append: true,
              searchTerm: gifSearchTerm,
            });
          }}
        />
      )}

      {mergedErrors.poll && (
        <p className="post-form__error">{mergedErrors.poll}</p>
      )}

      {!renderMediaManager && (
        <MediaPreviewGrid
          mediaItems={mediaItems}
          onRemoveMedia={handleRemoveMedia}
        />
      )}

      {mediaErrors.length > 0 && (
        <div className="create-post__media-errors post-composer__media-errors">
          {mediaErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? submitStep || pendingLabel : submitLabel}
      </button>

      {isPending && submitStep && (
        <p className="create-post__submit-step post-composer__submit-step">
          {submitStep}
        </p>
      )}

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}
