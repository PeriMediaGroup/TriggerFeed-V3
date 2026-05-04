"use client";

import { useEffect, useMemo, useState } from "react";

export default function SharePostButton({ postId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/posts/${postId}`;

    return `${window.location.origin}/posts/${postId}`;
  }, [postId]);

  function openShareModal() {
    setCopied(false);
    setIsOpen(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy share link:", error);
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" onClick={openShareModal}>
        Share
      </button>

      {isOpen && (
        <div className="share-modal" role="dialog" aria-modal="true">
          <div className="share-modal__panel">
            <div className="share-modal__header">
              <h2>Share this post</h2>
              <button type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            <p className="share-modal__description">
              Copy this link and send it wherever you want.
            </p>

            <label
              className="share-modal__label"
              htmlFor={`share-url-${postId}`}
            >
              Post link
            </label>

            <input
              id={`share-url-${postId}`}
              className="share-modal__input"
              type="text"
              value={shareUrl}
              readOnly
              onFocus={(event) => event.target.select()}
            />

            <div className="share-modal__actions">
              <button
                type="button"
                className="share-modal__copy"
                onClick={handleCopy}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
