"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GiphyFetch } from "@giphy/js-fetch-api";

import { createPost } from "../../actions/createPost";
import { uploadFilesToCloudinary } from "@/features/media/uploadToCloudinaryClient";
import { savePostMedia } from "@/features/posts/actions/savePostMedia";

import MentionInput from "@/features/mentions/components/MentionInputs";
import MentionTextarea from "@/features/mentions/components/MentionTextarea";

import CreatePostToolbar from "./CreatePostToolbar";
import MediaPicker from "./MediaPicker";
import MediaPreviewGrid from "./MediaPreviewGrid";
import CreatePostEmojiPicker from "./CreatePostEmojiPicker";
import CreatePostPollBuilder from "./CreatePostPollBuilder";
import CreatePostGifPicker from "./CreatePostGifPicker";

import {
  createMediaItemsFromFiles,
  revokeMediaPreview,
  revokeMediaPreviews,
} from "../utils/mediaHelpers";

import { cleanPollDraft, createEmptyPollDraft } from "../utils/pollHelpers";

const GIF_LIMIT = 12;

export default function CreatePostForm() {
  const router = useRouter();

  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [mediaErrors, setMediaErrors] = useState([]);
  const [mediaItems, setMediaItems] = useState([]);
  const [activeTool, setActiveTool] = useState(null);
  const [submitStep, setSubmitStep] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [isPending, startTransition] = useTransition();

  const mediaItemsRef = useRef([]);
  const [poll, setPoll] = useState(null);
  const [selectedGif, setSelectedGif] = useState(null);

  const [gifSearchTerm, setGifSearchTerm] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifOffset, setGifOffset] = useState(0);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const [gifStatus, setGifStatus] = useState("");

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

  async function loadGifs({
    nextOffset = 0,
    append = false,
    searchTerm,
  } = {}) {
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

  function resetForm(form) {
    form.reset();
    setPoll(null);
    setSelectedGif(null);

    revokeMediaPreviews(mediaItemsRef.current);

    setTitle("");
    setBody("");
    setMediaItems([]);
    setActiveTool(null);
    setMediaErrors([]);
    setGifSearchTerm("");
    setGifResults([]);
    setGifOffset(0);
    setGifStatus("");
    setSubmitStep("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const cleanedPoll = cleanPollDraft(poll);

    if (cleanedPoll?.error) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        poll: cleanedPoll.error,
      }));

      setStatus(cleanedPoll.error);
      return;
    }

    if (cleanedPoll?.poll) {
      formData.append("poll", JSON.stringify(cleanedPoll.poll));
    }

    if (selectedGif) {
      formData.append(
        "gif",
        JSON.stringify({
          ...selectedGif,
          sortOrder: mediaItems.length,
          displayOrder: mediaItems.length,
        }),
      );
    }

    startTransition(async () => {
      try {
        setErrors({});
        setMediaErrors([]);
        setStatus("");
        setSubmitStep("Creating post...");

        const result = await createPost(formData);

        if (!result.success) {
          setErrors(result.errors || {});
          setStatus(result.message || "Something went wrong.");
          setSubmitStep("");
          return;
        }

        if (mediaItems.length > 0) {
          setStatus(
            mediaItems.length === 1
              ? "Uploading media..."
              : `Uploading ${mediaItems.length} media files...`,
          );

          const uploadedMedia = await uploadFilesToCloudinary({
            files: mediaItems.map((item) => item.file),
            postId: result.postId,
            onProgress: ({ index, total }) => {
              setSubmitStep(`Uploading media ${index + 1} of ${total}...`);
            },
          });

          setSubmitStep("Saving media...");

          const saveMediaResult = await savePostMedia({
            postId: result.postId,
            media: uploadedMedia,
          });

          if (!saveMediaResult.success) {
            const saveMediaErrors = saveMediaResult.errors || [];

            setMediaErrors(saveMediaErrors);
            setStatus(
              saveMediaErrors[0] || "Post created, but media failed to save.",
            );
            setSubmitStep("");
            return;
          }
        }

        setSubmitStep("Finishing up...");
        setStatus("Post created.");

        resetForm(form);

        setTimeout(() => {
          window.location.assign(`/posts/${result.postId}`);
        }, 150);

        router.refresh();
      } catch (error) {
        console.error("CREATE POST SAVE ERROR:", error);
        setStatus(error?.message || "Create post failed. Check the console.");
        setSubmitStep("");
      }
    });
  }

  return (
    <form className="post-form create-post" onSubmit={handleSubmit}>
      <div className="post-form__field create-post__field">
        <label htmlFor="title">Title</label>

        <MentionInput
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Post title"
          maxLength={120}
        />

        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <div className="post-form__field create-post__field">
        <label htmlFor="body">Body</label>

        <MentionTextarea
          id="body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          maxLength={5000}
        />

        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <input type="hidden" name="visibility" value="public" />

      {errors.visibility && (
        <p className="post-form__error">{errors.visibility}</p>
      )}

      <CreatePostToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
      />

      {activeTool === "media" && <MediaPicker onAddMedia={handleAddMedia} />}

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

      {errors.poll && <p className="post-form__error">{errors.poll}</p>}

      <MediaPreviewGrid
        mediaItems={mediaItems}
        onRemoveMedia={handleRemoveMedia}
      />

      {mediaErrors.length > 0 && (
        <div className="create-post__media-errors">
          {mediaErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? submitStep || "Posting..." : "Post"}
      </button>

      {isPending && submitStep && (
        <p className="create-post__submit-step">{submitStep}</p>
      )}

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}
