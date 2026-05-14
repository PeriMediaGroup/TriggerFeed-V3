import FriendSearch from "@/features/friends/components/FriendSearch";
import FriendRequests from "@/features/friends/components/FriendRequests";
import FriendsList from "@/features/friends/components/FriendsList";
import EditTopFriends from "@/features/friends/components/EditTopFriends";

export default function FriendsPanel({
  incomingRequests = [],
  outgoingRequests = [],
  friends = [],
  acceptedFriends = [],
  topFriends = [],
}) {
  return (
    <section className="friends-panel">
      <header className="friends-panel__header">
        <h2>Friends</h2>
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
    </section>
  );
}