// src/app/profile/friends/page.jsx

import { redirect } from "next/navigation";

import { getFriendDashboard } from "@/features/friends/data/getFriendDashboard";
import { getAcceptedFriends } from "@/features/friends/data/getAcceptedFriends";
import { getFriendSuggestions } from "@/features/friends/data/getFriendSuggestions";
import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";

import FriendsPanel from "@/features/friends/components/FriendsPanel";

export default async function FriendsPage() {
  const { user, incomingRequests, outgoingRequests, friends, error } =
    await getFriendDashboard();

  if (error || !user) {
    redirect("/login");
  }

  const [
    { acceptedFriends },
    { topFriends },
    friendSuggestionsResult,
    { profile },
  ] =
    await Promise.all([
      getAcceptedFriends(),
      getTopFriends(user.id),
      getFriendSuggestions({ limit: 4, viewerId: user.id }),
      getCurrentProfile(),
    ]);
  const friendSuggestions = friendSuggestionsResult?.suggestions ?? [];

  return (
    <main className="friends-page">
      <header className="friends-page__header">
      </header>

      <FriendsPanel
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        friends={friends}
        acceptedFriends={acceptedFriends}
        topFriends={topFriends}
        viewerId={user.id}
        referralCode={profile?.referral_code}
        friendSuggestions={friendSuggestions}
        friendSuggestionsHasError={Boolean(friendSuggestionsResult?.error)}
        friendSuggestionsDidFetch={Boolean(friendSuggestionsResult?.didFetch)}
      />
    </main>
  );
}
