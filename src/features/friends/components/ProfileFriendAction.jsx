// src/features/friends/components/ProfileFriendAction.jsx

"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { sendFriendRequest } from "@/features/friends/actions/sendFriendRequest";
import { respondToFriendRequest } from "@/features/friends/actions/respondToFriendRequest";

export default function ProfileFriendAction({
  profileUserId,
  initialFriendStatus,
  friendship,
}) {
  const [friendStatus, setFriendStatus] = useState(initialFriendStatus);
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
    startTransition(async () => {
      const result = await sendFriendRequest(profileUserId);

      if (result.success) {
        setFriendStatus("outgoing_pending");
        toast.success(result.message || "Friend request sent.");
        return;
      }

      toast.error(result.message || "Could not send friend request.");
    });
  }

  function handleResponse(response) {
    if (!friendship?.id) {
      toast.error("Friend request not found.");
      return;
    }

    startTransition(async () => {
      const result = await respondToFriendRequest(friendship.id, response);

      if (result.success && response === "accepted") {
        setFriendStatus("friends");
        toast.success(result.message || "Friend request accepted.");
        return;
      }

      if (result.success && response === "declined") {
        setFriendStatus("none");
        toast.success(result.message || "Friend request declined.");
        return;
      }

      toast.error(result.message || "Could not update friend request.");
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
    </div>
  );
}
