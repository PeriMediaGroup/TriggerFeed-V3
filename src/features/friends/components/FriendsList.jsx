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

export default function FriendsList({ friends = [] }) {
  return (
    <section className="friends-list">
      <h2>My Friends</h2>

      {friends.length ? (
        <ul>
          {friends.map((friendship) => {
            const user = friendship.otherUser;
            const displayName = getDisplayName(user);

            return (
              <li key={friendship.id}>
                <Link href={`/profiles/${user?.id}`}>
                  {displayName}
                  {user?.username && <span> @{user.username}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No friends yet.</p>
      )}
    </section>
  );
}