// src/app/profile/friends/page.jsx

import { redirect } from "next/navigation";
import BackLink from "@/components/navigation/BackLink";

import { getFriendDashboard } from "@/features/friends/data/getFriendDashboard";
import { getAcceptedFriends } from "@/features/friends/data/getAcceptedFriends";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";

import FriendsPanel from "@/features/friends/components/FriendsPanel";

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
        <BackLink
          label="Back to Profile"
          fallbackHref="/profile"
          mode="history"
        />
      </header>

      <FriendsPanel
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        friends={friends}
        acceptedFriends={acceptedFriends}
      />
    </main>
  );
}