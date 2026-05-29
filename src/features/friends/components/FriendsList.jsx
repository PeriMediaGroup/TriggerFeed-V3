// src/features/friends/components/FriendsList.jsx

import Link from "next/link";

function getDisplayName(user) {
  return (
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Unknown user"
  );
}

export default function FriendsList({
  friends = [],
  selectedTopFriendIds = [],
  onAddTopFriend,
}) {
  const topFriendsFull = selectedTopFriendIds.length >= 4;

  return (
    <section className="friends-list">
      <h2>My Friends</h2>

      {friends.length ? (
        <ul className="friends-list__items">
          {friends.map((friendship) => {
            const user = friendship.otherUser;
            const displayName = getDisplayName(user);
            const isSelected = user?.id
              ? selectedTopFriendIds.includes(user.id)
              : false;

            return (
              <li key={friendship.id} className="friends-list__item">
                {user?.id ? (
                  <Link
                    href={`/profiles/${user.id}`}
                    className="friends-list__link"
                  >
                    <span>{displayName}</span>
                    {user.username && <small>@{user.username}</small>}
                  </Link>
                ) : (
                  <span className="friends-list__link">{displayName}</span>
                )}

                <button
                  type="button"
                  className="friends-list__top-button"
                  disabled={!user?.id || isSelected || topFriendsFull}
                  onClick={() => onAddTopFriend?.(user.id)}
                >
                  {isSelected ? "Top" : topFriendsFull ? "Full" : "+ Top"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="friends-list__empty">No friends yet.</p>
      )}
    </section>
  );
}