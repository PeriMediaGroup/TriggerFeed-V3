"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, MessageSquare, Share2 } from "lucide-react";

import { SITE_NAME, SITE_URL } from "@/lib/site";

const SMS_DESKTOP_MEDIA_QUERY = "(max-width: 767px)";

function getInviteUrl(referralCode) {
  if (!referralCode) {
    return "";
  }

  const url = new URL("/signup", SITE_URL);
  url.searchParams.set("ref", referralCode);

  return url.toString();
}

function getSmsBodySeparator() {
  if (typeof navigator === "undefined") {
    return "?";
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ? "&" : "?";
}

function copyTextFallback(value) {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";

  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function InviteFriends({ referralCode, className = "" }) {
  const [status, setStatus] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [smsBodySeparator, setSmsBodySeparator] = useState("?");

  const inviteUrl = useMemo(() => getInviteUrl(referralCode), [referralCode]);
  const emailSubject = "Join me on TriggerFeed";
  const emailBody = `I thought you might like TriggerFeed. Join me here: ${inviteUrl}`;
  const smsBody = `Join me on TriggerFeed: ${inviteUrl}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;
  const smsHref = `sms:${smsBodySeparator}body=${encodeURIComponent(smsBody)}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(SMS_DESKTOP_MEDIA_QUERY);
    const updateCapabilities = () => {
      setCanShare(Boolean(navigator.share));
      setSmsBodySeparator(getSmsBodySeparator());
      setIsMobileLayout(mediaQuery.matches);
    };
    const timeout = window.setTimeout(updateCapabilities, 0);

    mediaQuery.addEventListener("change", updateCapabilities);

    return () => {
      window.clearTimeout(timeout);
      mediaQuery.removeEventListener("change", updateCapabilities);
    };
  }, []);

  useEffect(() => {
    if (!status) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setStatus(""), 2400);

    return () => window.clearTimeout(timeout);
  }, [status]);

  async function handleCopyLink() {
    if (!inviteUrl) {
      setStatus("Invite link unavailable");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else if (!copyTextFallback(inviteUrl)) {
        throw new Error("Clipboard unavailable");
      }

      setStatus("Invite link copied");
    } catch {
      setStatus("Could not copy invite link");
    }
  }

  async function handleShare() {
    if (!inviteUrl || !navigator.share) {
      return;
    }

    try {
      await navigator.share({
        title: SITE_NAME,
        text: "Join me on TriggerFeed",
        url: inviteUrl,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatus("Could not open sharing");
      }
    }
  }

  return (
    <section className={`invite-friends ${className}`.trim()}>
      <div className="invite-friends__header">
        <div>
          <h3>Invite Friends</h3>
          <p>Know someone who should be here? Invite them to TriggerFeed.</p>
        </div>

        {status ? (
          <span className="invite-friends__status" role="status">
            {status === "Invite link copied" ? (
              <Check size={14} strokeWidth={2.4} aria-hidden="true" />
            ) : null}
            {status}
          </span>
        ) : null}
      </div>

      {inviteUrl ? (
        <>
          <label className="invite-friends__link-field">
            <span>Invite link</span>
            <input type="text" value={inviteUrl} readOnly />
          </label>

          <div className="invite-friends__actions">
            <button
              type="button"
              className="invite-friends__action"
              onClick={handleCopyLink}
            >
              <Copy size={16} strokeWidth={2.2} aria-hidden="true" />
              Copy Link
            </button>

            {isMobileLayout ? (
              <a
                className="invite-friends__action invite-friends__action--sms"
                href={smsHref}
                aria-label="Invite by text message"
              >
                <MessageSquare size={16} strokeWidth={2.2} aria-hidden="true" />
                Text
              </a>
            ) : null}

            <a
              className="invite-friends__action"
              href={emailHref}
              aria-label="Invite by email"
            >
              <Mail size={16} strokeWidth={2.2} aria-hidden="true" />
              Email
            </a>

            {canShare ? (
              <button
                type="button"
                className="invite-friends__action"
                onClick={handleShare}
              >
                <Share2 size={16} strokeWidth={2.2} aria-hidden="true" />
                Share
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="invite-friends__empty">
          Your invite link will be available after your referral code is created.
        </p>
      )}
    </section>
  );
}
