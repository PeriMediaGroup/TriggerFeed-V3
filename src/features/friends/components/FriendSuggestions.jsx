"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { sendFriendRequest } from "@/features/friends/actions/sendFriendRequest";
import { DEFAULT_PROFILE_AVATAR_URL } from "@/features/profiles/constants/profileImages";

export default function FriendSuggestions({
  viewerId = null,
  suggestions: initialSuggestions = [],
  hasError = false,
  didFetch = false,
}) {
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState(
    () => new Set()
  );
  const [pendingId, setPendingId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const suggestions = initialSuggestions.filter(
    (suggestion) => !dismissedSuggestionIds.has(suggestion.id)
  );

  if (!viewerId) {
    return null;
  }

  function handleSendRequest(userId) {
    setPendingId(userId);

    startTransition(async () => {
      const result = await sendFriendRequest(userId);

      if (result.success) {
        setDismissedSuggestionIds(
          (current) => new Set([...current, userId])
        );
        toast.success(result.message || "Friend request sent.");
        setPendingId(null);
        return;
      }

      toast.error(result.message || "Could not send friend request.");
      setPendingId(null);
    });
  }

  return (
    <section className="app-right-rail__module friend-suggestions">
      <div className="app-right-rail__module-inner friend-suggestions__inner">
        <h2 className="friend-suggestions__title">Friend Suggestions</h2>

        {hasError && (
          <p className="friend-suggestions__error">
            Could not load suggestions.
          </p>
        )}

        {!hasError && !didFetch && (
          <p className="friend-suggestions__loading">Loading suggestions...</p>
        )}

        {!hasError && didFetch && suggestions.length === 0 && (
          <p className="friend-suggestions__empty">
            No suggestions right now.
          </p>
        )}

        {!hasError && didFetch && suggestions.length > 0 && (
          <ul className="friend-suggestions__list">
            {suggestions.map((suggestion) => {
              const avatarUrl =
                suggestion.avatarUrl || DEFAULT_PROFILE_AVATAR_URL;
              const isAdding = isPending && pendingId === suggestion.id;

              return (
                <li key={suggestion.id} className="friend-suggestions__item">
                  <Link
                    className="friend-suggestions__avatar"
                    href={`/profiles/${suggestion.id}`}
                    aria-label={`View ${suggestion.displayName}'s profile`}
                  >
                    <Image
                      src={avatarUrl}
                      alt=""
                      width={40}
                      height={40}
                      sizes="40px"
                    />
                  </Link>

                  <div className="friend-suggestions__body">
                    <Link
                      className="friend-suggestions__name"
                      href={`/profiles/${suggestion.id}`}
                    >
                      {suggestion.displayName}
                    </Link>
                    {suggestion.username && (
                      <span className="friend-suggestions__username">
                        @{suggestion.username}
                      </span>
                    )}
                    <span className="friend-suggestions__reason">
                      {suggestion.reason}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="friend-suggestions__action"
                    disabled={isPending}
                    onClick={() => handleSendRequest(suggestion.id)}
                  >
                    {isAdding ? "Adding..." : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
