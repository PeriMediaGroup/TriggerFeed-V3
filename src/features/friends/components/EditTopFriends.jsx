// src/features/profiles/components/EditTopFriends.jsx

"use client";

import { useMemo } from "react";

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
  selectedIds = [],
  isPending = false,
  saveMessage = "",
  onMoveTopFriend,
  onRemoveTopFriend,
}) {
  const acceptedFriendMap = useMemo(
    () => new Map(acceptedFriends.map((friend) => [friend.id, friend])),
    [acceptedFriends],
  );

  const selectedFriends = selectedIds
    .map((friendId) => acceptedFriendMap.get(friendId))
    .filter(Boolean);

  return (
    <section className="edit-top-friends">
      <div className="edit-top-friends__header">
        <div>
          <h2>Top Friends</h2>
          <p>Choose up to 4 friends to show on your profile.</p>
        </div>

        {saveMessage && (
          <span
            className={`edit-top-friends__status ${
              isPending ? "is-saving" : "is-saved"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>

      {acceptedFriends.length === 0 ? (
        <p className="edit-top-friends__empty">
          You do not have any accepted friends yet.
        </p>
      ) : selectedFriends.length > 0 ? (
        <ol className="edit-top-friends__selected-list">
          {selectedFriends.map((friend, index) => {
            const displayName = getDisplayName(friend);
            const isFirst = index === 0;
            const isLast = index === selectedFriends.length - 1;

            return (
              <li key={friend.id} className="edit-top-friends__selected-item">
                <span className="edit-top-friends__rank">{index + 1}</span>

                <span className="edit-top-friends__selected-name">
                  {displayName}
                  {friend.username && <small> @{friend.username}</small>}
                </span>

                <div className="edit-top-friends__selected-actions">
                  <button
                    type="button"
                    disabled={isFirst || isPending}
                    onClick={() => onMoveTopFriend?.(friend.id, "up")}
                    aria-label={`Move ${displayName} up`}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={isLast || isPending}
                    onClick={() => onMoveTopFriend?.(friend.id, "down")}
                    aria-label={`Move ${displayName} down`}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRemoveTopFriend?.(friend.id)}
                    aria-label={`Remove ${displayName} from top friends`}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="edit-top-friends__empty">No top friends selected.</p>
      )}
    </section>
  );
}