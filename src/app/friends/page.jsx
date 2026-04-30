// src/app/friends/page.jsx

import { redirect } from "next/navigation";

import { getFriendDashboard } from "@/features/friends/data/getFriendDashboard";
import FriendSearch from "@/features/friends/components/FriendSearch";
import FriendRequests from "@/features/friends/components/FriendRequest";
import FriendsList from "@/features/friends/components/FriendsList";

export default async function FriendsPage() {
  const { user, incomingRequests, outgoingRequests, friends, error } =
    await getFriendDashboard();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="friends-page">
      <header className="friends-page__header">
        <h1>Friends</h1>
        <p>Find people, manage requests, and view your friends.</p>
      </header>

      <FriendSearch />

      <FriendRequests
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
      />

      <FriendsList friends={friends} />
    </main>
  );
}
