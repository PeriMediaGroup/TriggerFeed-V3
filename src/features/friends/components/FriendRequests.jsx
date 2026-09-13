// src/features/friends/components/FriendRequests.jsx

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { respondToFriendRequest } from "@/features/friends/actions/respondToFriendRequest";
import FoundingMemberBadge from "@/features/profiles/components/FoundingMemberBadge";

function getDisplayName(user) {
  return (
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Unknown user"
  );
}

export default function FriendRequests({ incomingRequests = [], outgoingRequests = [] }) {
  const [isPending, startTransition] = useTransition();

  function handleResponse(requestId, response) {
    startTransition(async () => {
      await respondToFriendRequest(requestId, response);
    });
  }

  return (
    <section className="friend-requests">
      <h2>Friend Requests</h2>

      <div className="friend-requests__group">
        <h3>Incoming</h3>

        {incomingRequests.length ? (
          <ul>
            {incomingRequests.map((request) => {
              const user = request.otherUser;
              const displayName = getDisplayName(user);

              return (
                <li key={request.id}>
                  <Link href={`/profiles/${user?.id}`}>{displayName}</Link>
                  <FoundingMemberBadge number={user?.founding_member_number} />

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleResponse(request.id, "accepted")}
                  >
                    Accept
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleResponse(request.id, "declined")}
                  >
                    Decline
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No incoming requests.</p>
        )}
      </div>

      <div className="friend-requests__group">
        <h3>Outgoing</h3>

        {outgoingRequests.length ? (
          <ul>
            {outgoingRequests.map((request) => {
              const user = request.otherUser;
              const displayName = getDisplayName(user);

              return (
                <li key={request.id}>
                  <Link href={`/profiles/${user?.id}`}>{displayName}</Link>
                  <FoundingMemberBadge number={user?.founding_member_number} />
                  <span className="friend-requests__pending">Pending</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No outgoing requests.</p>
        )}
      </div>
    </section>
  );
}
