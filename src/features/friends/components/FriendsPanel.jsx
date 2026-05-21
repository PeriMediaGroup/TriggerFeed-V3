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
    <>
      <header className="friends-panel__header">
        <p>Find people, manage requests, and view your friends.</p>
      </header>
    <section className="friends-panel">

      <FriendRequests
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
      />

      <FriendSearch />

      <EditTopFriends
        acceptedFriends={acceptedFriends}
        currentTopFriends={topFriends}
      />

      <FriendsList friends={friends} />
    </section>
    </>
  );
}