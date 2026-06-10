"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { X } from "lucide-react";
import {
  formatMilestoneMessage,
  getMilestoneMessages,
} from "@/features/milestones/milestoneMessages";

const STORAGE_EVENT = "triggerfeed:milestone-storage";

function getDismissedStorageKey(userId, milestoneType, dateKey) {
  if (!userId || !milestoneType || !dateKey) {
    return null;
  }

  return `triggerfeed:milestone-dismissed:${userId}:${milestoneType}:${dateKey}`;
}

function getMessageStorageKey(userId, milestoneType, dateKey) {
  if (!userId || !milestoneType || !dateKey) {
    return null;
  }

  return `triggerfeed:milestone-message-index:${userId}:${milestoneType}:${dateKey}`;
}

function subscribeToStorageChanges(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getDismissedSnapshot(storageKey) {
  if (!storageKey || typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(storageKey) === "true";
}

function getOrCreateMessageIndex(storageKey, messageCount) {
  if (!storageKey || typeof window === "undefined" || messageCount <= 0) {
    return null;
  }

  const savedIndex = Number.parseInt(window.localStorage.getItem(storageKey), 10);

  if (
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < messageCount
  ) {
    return savedIndex;
  }

  const nextIndex = Math.floor(Math.random() * messageCount);
  window.localStorage.setItem(storageKey, String(nextIndex));
  return nextIndex;
}

function getDisplayName({ firstName, displayName, username }) {
  return firstName || displayName || username || "there";
}

export default function BirthdayGreeting({
  userId,
  dateKey,
  isBirthdayToday = false,
  isActive = null,
  firstName = "",
  displayName = "",
  username = "",
  milestoneType = "birthday",
  years = null,
  rankName = "",
  onDismissAction = null,
}) {
  const [, startTransition] = useTransition();
  const [selectedMessageSelection, setSelectedMessageSelection] =
    useState(null);
  const messages = getMilestoneMessages(milestoneType);
  const shouldShowMilestone = isActive ?? isBirthdayToday;
  const dismissedStorageKey = getDismissedStorageKey(
    userId,
    milestoneType,
    dateKey,
  );
  const messageStorageKey = getMessageStorageKey(userId, milestoneType, dateKey);
  const isDismissed = useSyncExternalStore(
    subscribeToStorageChanges,
    () => getDismissedSnapshot(dismissedStorageKey),
    () => false,
  );

  useEffect(() => {
    if (!userId || !dateKey || !shouldShowMilestone || isDismissed) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      const messageIndex = getOrCreateMessageIndex(
        messageStorageKey,
        messages.length,
      );

      setSelectedMessageSelection({
        storageKey: messageStorageKey,
        index: messageIndex,
      });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [
    dateKey,
    isDismissed,
    messageStorageKey,
    messages.length,
    shouldShowMilestone,
    userId,
  ]);

  if (
    !userId ||
    !dateKey ||
    !shouldShowMilestone ||
    isDismissed ||
    selectedMessageSelection?.storageKey !== messageStorageKey ||
    selectedMessageSelection.index === null
  ) {
    return null;
  }

  const selectedMessage = messages[selectedMessageSelection.index];

  if (!selectedMessage) {
    return null;
  }

  const yearCount = Number.isFinite(Number(years)) ? Number(years) : "";
  const replacements = {
    name: getDisplayName({ firstName, displayName, username }),
    years: yearCount,
    yearPlural: yearCount === 1 ? "year" : "years",
    rankName: rankName || "new rank",
  };

  function handleDismiss() {
    if (!dismissedStorageKey || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(dismissedStorageKey, "true");
    window.dispatchEvent(new Event(STORAGE_EVENT));

    if (onDismissAction) {
      startTransition(async () => {
        await onDismissAction();
      });
    }
  }

  return (
    <section className="birthday-greeting" aria-label="Milestone greeting">
      <div className="birthday-greeting__copy">
        <h2 className="birthday-greeting__title">
          {formatMilestoneMessage(selectedMessage.title, replacements)}
        </h2>
        <p className="birthday-greeting__message">
          {formatMilestoneMessage(selectedMessage.body, replacements)}
        </p>
      </div>

      <button
        type="button"
        className="birthday-greeting__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss birthday greeting"
      >
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </section>
  );
}
