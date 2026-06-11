import "server-only";

import { Resend } from "resend";

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MODERATION_EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      skipped: true,
      reason: "Missing RESEND_API_KEY or MODERATION_EMAIL_FROM",
      resend: null,
      from: null,
    };
  }

  return {
    skipped: false,
    reason: null,
    resend: new Resend(apiKey),
    from,
  };
}
