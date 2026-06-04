"use client";

import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Share, X } from "lucide-react";

export default function SharePostButton({ postId, variant = "default" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isIcon = variant === "icon";

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/posts/${postId}`;

    return `${window.location.origin}/posts/${postId}`;
  }, [postId]);

  function openShareModal() {
    setCopied(false);
    setIsOpen(true);
  }

  function getXShareUrl(url) {
    const text = "Check out this post on TriggerFeed";

    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(url)}`;
  }

  function getFacebookShareUrl(url) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url,
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
      <button
        type="button"
        className={isIcon ? "post-card__icon-action" : "share-post__button"}
        onClick={openShareModal}
        aria-label={isIcon ? "Share post" : undefined}
        title={isIcon ? "Share post" : undefined}
      >
        <Share size={16} strokeWidth={2} aria-hidden="true" />
        {!isIcon && <span>Share</span>}
      </button>

      {isOpen && (
        <div className="share-modal" role="dialog" aria-modal="true">
          <div className="share-modal__panel">
            <div className="share-modal__header">
              <h2>Share this post</h2>

              <button
                type="button"
                className="share-modal__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close share dialog"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
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

            <div className="share-modal__socials">
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
            </div>

            {shareUrl && (
              <div className="share-modal__qr">
                <QRCodeCanvas value={shareUrl} size={160} includeMargin />

                <p className="share-modal__qr-text">
                  Scan this QR code to open the post.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}