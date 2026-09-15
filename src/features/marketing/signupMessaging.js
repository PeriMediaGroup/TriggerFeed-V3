import {
  normalizeAttributionToken,
  readStoredAttribution,
} from "@/features/marketing/attribution";

export const DEFAULT_SIGNUP_MESSAGING = {
  eyebrow: "18+ firearms community",
  title: "Welcome to TriggerFeed",
  intro:
    "Join a community built for people who train, shoot, build, collect, carry, and actually use the gear they talk about.",
};

export const SIGNUP_MESSAGING_BY_SOURCE = {
  sawmill: {
    eyebrow: "Found us at Sawmill?",
    title: "Hope you had a good day on the range.",
    intro:
      "Keep the range-day conversation going. TriggerFeed is an 18+ community for training, gear, firearms, local connections, and people who take getting better seriously.",
  },

  psa: {
    eyebrow: "Found us at PSA?",
    title: "You’re already in familiar territory.",
    intro:
      "TriggerFeed is an 18+ firearms community for range days, builds, gear, training, reviews, and real conversation with people who are into the same things you are.",
  },

  "psa-range": {
    eyebrow: "Coming off the PSA range?",
    title: "Range day doesn’t have to end at the door.",
    intro:
      "Join TriggerFeed and keep talking training, gear, drills, builds, and the next trip to the range with an 18+ community built around the firearms lifestyle.",
  },

  "greenville-gun-show": {
    eyebrow: "Found us at the Greenville Gun Show?",
    title: "Take the conversation home with you.",
    intro:
      "TriggerFeed is an 18+ community for shooters, collectors, builders, trainers, and enthusiasts who want to keep talking long after the tables pack up.",
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
  const sourceFromUrl = normalizeAttributionToken(
    url.searchParams.get("source")
  );

  if (sourceFromUrl) {
    return getSignupMessagingForSource(sourceFromUrl);
  }

  return getSignupMessagingForSource(readStoredAttribution()?.source);
}