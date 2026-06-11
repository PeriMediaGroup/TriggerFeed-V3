"use client";

import { useMemo, useState, useTransition } from "react";
import FriendSearch from "@/features/friends/components/FriendSearch";
import FriendRequests from "@/features/friends/components/FriendRequests";
import FriendSuggestions from "@/features/friends/components/FriendSuggestions";
import FriendsList from "@/features/friends/components/FriendsList";
import EditTopFriends from "@/features/friends/components/EditTopFriends";
import { updateTopFriends } from "@/features/profiles/actions/updateTopFriends";

const saveInitialState = {
  success: false,
  message: "",
  errors: {},
};

function getFriendProfile(item) {
  return item?.otherUser || item?.friend || item?.profile || item;
}

function getProfileId(item) {
  const profile = getFriendProfile(item);

  return (
    profile?.id ||
    item?.friend_user_id ||
    item?.friend_id ||
    item?.profile_id ||
    null
  );
}

export default function FriendsPanel({
  incomingRequests = [],
  outgoingRequests = [],
  friends = [],
  acceptedFriends = [],
  topFriends = [],
  viewerId = null,
  friendSuggestions = [],
  friendSuggestionsHasError = false,
  friendSuggestionsDidFetch = false,
}) {
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");

  const allFriendProfiles = useMemo(() => {
    const source = acceptedFriends.length ? acceptedFriends : friends;
    const map = new Map();

    source.forEach((item) => {
      const profile = getFriendProfile(item);

      if (profile?.id) {
        map.set(profile.id, profile);
      }
    });

    return Array.from(map.values());
  }, [acceptedFriends, friends]);

  const initialSelectedIds = useMemo(
    () => topFriends.map((item) => getProfileId(item)).filter(Boolean).slice(0, 4),
    [topFriends],
  );

  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);

  function autosaveTopFriends(nextIds) {
    setSelectedIds(nextIds);
    setSaveMessage("Saving...");

    startTransition(async () => {
      const formData = new FormData();

      nextIds.forEach((friendId) => {
        formData.append("top_friend_ids", friendId);
      });

      const result = await updateTopFriends(saveInitialState, formData);

      if (result?.success) {
        setSaveMessage("Saved");
        return;
      }

      setSaveMessage(result?.message || "Could not save top friends.");
    });
  }

  function addTopFriend(friendId) {
    if (!friendId) return;

    const nextIds = (() => {
      if (selectedIds.includes(friendId)) return selectedIds;
      if (selectedIds.length >= 4) return selectedIds;

      return [...selectedIds, friendId];
    })();

    if (nextIds !== selectedIds) {
      autosaveTopFriends(nextIds);
    }
  }

  function removeTopFriend(friendId) {
    const nextIds = selectedIds.filter((id) => id !== friendId);

    if (nextIds.length !== selectedIds.length) {
      autosaveTopFriends(nextIds);
    }
  }

  function moveTopFriend(friendId, direction) {
    const currentIndex = selectedIds.indexOf(friendId);

    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;

    const nextIds = [...selectedIds];

    [nextIds[currentIndex], nextIds[targetIndex]] = [
      nextIds[targetIndex],
      nextIds[currentIndex],
    ];

    autosaveTopFriends(nextIds);
  }

  return (
    <>
      <section className="friends-panel">
        <div className="friends-panel__grid">
          <FriendRequests
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
          />

          <div className="friends-panel__mobile-suggestions">
            <FriendSuggestions
              key={viewerId || "signed-out"}
              viewerId={viewerId}
              suggestions={friendSuggestions}
              hasError={friendSuggestionsHasError}
              didFetch={friendSuggestionsDidFetch}
            />
          </div>

          <FriendSearch />
        </div>

        <div className="friends-panel__grid">
          <EditTopFriends
            acceptedFriends={allFriendProfiles}
            selectedIds={selectedIds}
            isPending={isPending}
            saveMessage={saveMessage}
            onMoveTopFriend={moveTopFriend}
            onRemoveTopFriend={removeTopFriend}
          />

          <FriendsList
            friends={friends}
            selectedTopFriendIds={selectedIds}
            onAddTopFriend={addTopFriend}
          />
        </div>
      </section>
    </>
  );
}
