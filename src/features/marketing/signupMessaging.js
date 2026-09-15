import {
  normalizeAttributionToken,
  readStoredAttribution,
} from "@/features/marketing/attribution";

export const DEFAULT_SIGNUP_MESSAGING = {
  eyebrow: "18+ community",
  title: "Start your TriggerFeed account",
  intro:
    "Your date of birth is required for age verification and is hidden from your public profile by default.",
};

export const SIGNUP_MESSAGING_BY_SOURCE = {
  sawmill: {
    eyebrow: "Welcome, Sawmill community",
    title: "Start your TriggerFeed account",
    intro:
      "Join the 18+ TriggerFeed community for practical firearms conversation, local connections, and field notes from people who care about doing things right.",
  },
  psa: {
    eyebrow: "Welcome, PSA community",
    title: "Start your TriggerFeed account",
    intro:
      "TriggerFeed is an 18+ space for responsible firearms owners, builders, and enthusiasts to connect without the noise.",
  },
  "greenville-gun-show": {
    eyebrow: "Welcome from Greenville",
    title: "Start your TriggerFeed account",
    intro:
      "Thanks for checking out TriggerFeed. Join the 18+ community built for firearms people, range days, and real conversations.",
  },
};

export function getSignupMessagingForSource(source) {
  const normalizedSource = normalizeAttributionToken(source);

  return SIGNUP_MESSAGING_BY_SOURCE[normalizedSource] || DEFAULT_SIGNUP_MESSAGING;
}

export function getInitialSignupMessaging() {
  if (typeof window === "undefined") {
    return DEFAULT_SIGNUP_MESSAGING;
  }

  const url = new URL(window.location.href);
  const sourceFromUrl = normalizeAttributionToken(url.searchParams.get("source"));

  if (sourceFromUrl) {
    return getSignupMessagingForSource(sourceFromUrl);
  }

  return getSignupMessagingForSource(readStoredAttribution()?.source);
}
