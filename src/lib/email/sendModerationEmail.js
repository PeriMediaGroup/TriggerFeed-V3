import "server-only";

import { getResendClient } from "@/lib/email/resend";

const ACTION_COPY = {
  muted: {
    subject: "Your TriggerFeed account has been muted",
    label: "muted",
  },
  banned: {
    subject: "Your TriggerFeed account has been banned",
    label: "banned",
  },
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatExpiration(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function buildBody({ username, display_name, action, reason, expires_at }) {
  const actionCopy = ACTION_COPY[action];
  const name = username || display_name || "TriggerFeed user";
  const expiration = formatExpiration(expires_at);

  const lines = [
    `Hello ${name},`,
    `Your TriggerFeed account has been ${actionCopy.label}.`,
  ];

  if (reason) {
    lines.push(`Reason: ${reason}`);
  }

  if (expiration) {
    lines.push(`Expiration: ${expiration} UTC`);
  }

  lines.push(
    "If you believe this was a mistake, contact support@triggerfeed.com.",
  );

  return lines;
}

export async function sendModerationEmail(context) {
  const actionCopy = ACTION_COPY[context?.action];

  if (!actionCopy) {
    return {
      sent: false,
      skipped: true,
      error: "No email template for moderation action",
    };
  }

  if (!context?.email) {
    return {
      sent: false,
      skipped: true,
      error: "Target user has no email address",
    };
  }

  const resendConfig = getResendClient();

  if (resendConfig.skipped) {
    console.warn("MODERATION EMAIL SKIPPED:", resendConfig.reason);

    return {
      sent: false,
      skipped: true,
      error: resendConfig.reason,
    };
  }

  const safeLines = buildBody(context);
  const text = safeLines.join("\n\n");
  const html = safeLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  try {
    const result = await resendConfig.resend.emails.send({
      from: resendConfig.from,
      to: context.email,
      subject: actionCopy.subject,
      html,
      text,
    });

    if (result?.error) {
      return {
        sent: false,
        skipped: false,
        error: result.error.message || "Resend rejected the email",
      };
    }

    return {
      sent: true,
      skipped: false,
      error: null,
    };
  } catch (error) {
    return {
      sent: false,
      skipped: false,
      error: error?.message || "Resend email failed",
    };
  }
}
