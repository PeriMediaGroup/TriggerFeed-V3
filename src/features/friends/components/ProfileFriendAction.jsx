// src/features/friends/components/ProfileFriendAction.jsx

"use client";

import { useState, useTransition } from "react";
import { sendFriendRequest } from "@/features/friends/actions/sendFriendRequest";
import { respondToFriendRequest } from "@/features/friends/actions/respondToFriendRequest";

export default function ProfileFriendAction({
  profileUserId,
  initialFriendStatus,
  friendship,
}) {
  const [friendStatus, setFriendStatus] = useState(initialFriendStatus);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (friendStatus === "self") {
    return null;
  }

  if (friendStatus === "logged_out") {
    return (
      <div className="profile-friend-action">
        <p>Log in to add this user as a friend.</p>
      </div>
    );
  }

  function handleSendRequest() {
    setMessage("");

    startTransition(async () => {
      const result = await sendFriendRequest(profileUserId);

      setMessage(result.message || "");

      if (result.success) {
        setFriendStatus("outgoing_pending");
      }
    });
  }

  function handleResponse(response) {
    if (!friendship?.id) {
      setMessage("Friend request not found.");
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await respondToFriendRequest(friendship.id, response);

      setMessage(result.message || "");

      if (result.success && response === "accepted") {
        setFriendStatus("friends");
      }

      if (result.success && response === "declined") {
        setFriendStatus("none");
      }
    });
  }

  return (
    <div className="profile-friend-action">
      {friendStatus === "none" && (
        <button type="button" disabled={isPending} onClick={handleSendRequest}>
          {isPending ? "Sending..." : "Add Friend"}
        </button>
      )}

      {friendStatus === "outgoing_pending" && (
        <button type="button" disabled>
          Request Sent
        </button>
      )}

      {friendStatus === "incoming_pending" && (
        <div className="profile-friend-action__buttons">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleResponse("accepted")}
          >
            Accept
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleResponse("declined")}
          >
            Decline
          </button>
        </div>
      )}

      {friendStatus === "friends" && (
        <button type="button" disabled>
          Friends
        </button>
      )}

      {friendStatus === "declined" && (
        <button type="button" disabled>
          Request Declined
        </button>
      )}

      {friendStatus === "blocked" && (
        <button type="button" disabled>
          Unavailable
        </button>
      )}

      {message && <p className="profile-friend-action__message">{message}</p>}
    </div>
  );
}