// src/features/friends/components/FriendSearch.jsx

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { sendFriendRequest } from "@/features/friends/actions/sendFriendRequest";

function getDisplayName(user) {
  return (
    user?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Unknown user"
  );
}

export default function FriendSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSearch(value) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    const response = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`);
    const data = await response.json();

    setResults(data.users || []);
    setIsSearching(false);
  }

  function handleSendRequest(userId) {
    startTransition(async () => {
      const result = await sendFriendRequest(userId);

      if (result.success) {
        setResults((current) => current.filter((user) => user.id !== userId));
        toast.success(result.message || "Friend request sent.");
        return;
      }

      toast.error(result.message || "Could not send friend request.");
    });
  }

  return (
    <section className="friends-search">
      <h2>Find Friends</h2>

      <label htmlFor="friend-search">Search by username or name</label>
      <input
        id="friend-search"
        type="search"
        value={query}
        onChange={(event) => handleSearch(event.target.value)}
        placeholder="@username or name"
      />

      {isSearching && <p className="friends-search__status">Searching...</p>}

      {results.length > 0 && (
        <ul className="friends-search__results">
          {results.map((user) => {
            const displayName = getDisplayName(user);

            return (
              <li key={user.id} className="friends-search__result">
                <Link href={`/profiles/${user.id}`}>
                  {displayName}
                  {user.username && <span> @{user.username}</span>}
                </Link>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSendRequest(user.id)}
                >
                  Add Friend
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
