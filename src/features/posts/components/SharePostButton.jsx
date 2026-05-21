"use client";

import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Share } from "lucide-react";

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

  function getXShareUrl(shareUrl) {
    const text = "Check out this post on TriggerFeed";

    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(shareUrl)}`;
  }

  function getFacebookShareUrl(shareUrl) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      shareUrl,
    )}`;
  }
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleNativeShare() {
    if (!navigator.share || !shareUrl) return;

    try {
      await navigator.share({
        title: "TriggerFeed post",
        text: "Check out this post on TriggerFeed.",
        url: shareUrl,
      });
    } catch {
      // User canceled or browser declined.
    }
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
        <Share size={16} aria-hidden="true" />
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
            <div>
              <a
                href={getXShareUrl(shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="share-modal__social"
              >
                Share to X
              </a>

              <a
                href={getFacebookShareUrl(shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="share-modal__social"
              >
                Share to Facebook
              </a>
              {canNativeShare && (
                <button
                  type="button"
                  className="share-modal__native"
                  onClick={handleNativeShare}
                >
                  Share from device
                </button>
              )}
              {shareUrl && (
                <div className="share-modal__qr">
                  <QRCodeCanvas value={shareUrl} size={160} includeMargin />

                  <p className="share-modal__qr-text">
                    Scan this QR code to open the post on another device.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
