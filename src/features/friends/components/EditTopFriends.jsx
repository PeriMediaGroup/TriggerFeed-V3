// src/features/profiles/components/EditTopFriends.jsx

"use client";

import { useActionState, useMemo, useState } from "react";
import { updateTopFriends } from "@/features/profiles/actions/updateTopFriends";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

function getDisplayName(profile) {
  return (
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.username ||
    "Unknown user"
  );
}

export default function EditTopFriends({
  acceptedFriends = [],
  currentTopFriends = [],
}) {
  const [state, formAction, isPending] = useActionState(
    updateTopFriends,
    initialState,
  );

  const initialSelectedIds = useMemo(
    () =>
      currentTopFriends
        .map((item) => item.friend?.id)
        .filter(Boolean)
        .slice(0, 4),
    [currentTopFriends],
  );

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);

  function toggleFriend(friendId) {
    setSelectedIds((current) => {
      if (current.includes(friendId)) {
        return current.filter((id) => id !== friendId);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, friendId];
    });
  }

  const acceptedFriendMap = new Map(
    acceptedFriends.map((friend) => [friend.id, friend]),
  );

  const selectedFriends = selectedIds
    .map((friendId) => acceptedFriendMap.get(friendId))
    .filter(Boolean);

  const availableFriends = acceptedFriends.filter(
    (friend) => !selectedIds.includes(friend.id),
  );

  return (
    <section className="edit-top-friends">
      <h2>Top Friends</h2>
      <p>Choose up to 4 friends to show on your profile.</p>

      {state?.message && (
        <p className="edit-top-friends__message">{state.message}</p>
      )}

      {acceptedFriends.length === 0 ? (
        <p>You do not have any accepted friends yet.</p>
      ) : (
        <form action={formAction}>
          <div className="edit-top-friends__selected">
            <h3>Selected</h3>

            {selectedFriends.length > 0 ? (
              <ol>
                {selectedFriends.map((friend) => (
                  <li key={friend.id}>
                    <span>
                      {getDisplayName(friend)}
                      {friend.username && <small> @{friend.username}</small>}
                    </span>

                    <button
                      type="button"
                      aria-label={`Remove ${getDisplayName(friend)} from top friends`}
                      onClick={() => toggleFriend(friend.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No top friends selected.</p>
            )}
          </div>

          {selectedIds.map((friendId) => (
            <input
              key={friendId}
              type="hidden"
              name="top_friend_ids"
              value={friendId}
            />
          ))}

          <div className="edit-top-friends__options">
            {availableFriends.map((friend) => {
              const isDisabled = selectedIds.length >= 4;

              return (
                <div>
                  <button
                    key={friend.id}
                    type="button"
                    disabled={isDisabled}
                    className="edit-top-friends__friend"
                    onClick={() => toggleFriend(friend.id)}
                  >
                    <span>{getDisplayName(friend)}</span>
                    {friend.username && <small>@{friend.username}</small>}
                    <strong>Select</strong>
                  </button>

                  {availableFriends.length === 0 && (
                    <p className="edit-top-friends__empty">
                      No more friends available to add.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Top Friends"}
          </button>
        </form>
      )}
    </section>
  );
}
