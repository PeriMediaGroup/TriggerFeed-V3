// src/app/profile/friends/page.jsx

import { redirect } from "next/navigation";
import BackLink from "@/components/navigation/BackLink";

import { getFriendDashboard } from "@/features/friends/data/getFriendDashboard";
import { getAcceptedFriends } from "@/features/friends/data/getAcceptedFriends";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";

import FriendSearch from "@/features/friends/components/FriendSearch";
import FriendRequests from "@/features/friends/components/FriendRequests";
import FriendsList from "@/features/friends/components/FriendsList";
import EditTopFriends from "@/features/friends/components/EditTopFriends";

export default async function FriendsPage() {
  const { user, incomingRequests, outgoingRequests, friends, error } =
    await getFriendDashboard();

  if (error || !user) {
    redirect("/login");
  }

  const [{ acceptedFriends }, { topFriends }] = await Promise.all([
    getAcceptedFriends(),
    getTopFriends(user.id),
  ]);

  return (
    <main className="friends-page">
      <header className="friends-page__header">
        {" "}
        <BackLink
          label="Back to Profile"
          fallbackHref="/profile"
          mode="history"
        />
        <h1>Friends</h1>
        <p>Find people, manage requests, and view your friends.</p>
      </header>

      <FriendSearch />

      <FriendRequests
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
      />

      <FriendsList friends={friends} />

      <EditTopFriends
        acceptedFriends={acceptedFriends}
        currentTopFriends={topFriends}
      />
    </main>
  );
}
