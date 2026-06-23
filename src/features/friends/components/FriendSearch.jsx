// src/features/friends/components/FriendSearch.jsx

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { sendFriendRequest } from "@/features/friends/actions/sendFriendRequest";
import { DEFAULT_PROFILE_AVATAR_URL } from "@/features/profiles/constants/profileImages";
import { createClient } from "@/lib/supabase/client";

function getDisplayName(user) {
  return user?.display_name || user?.username || "Unknown user";
}

function getFriendAction(user) {
  if (user.friendship_status === "accepted") {
    return { label: "Friends", disabled: true };
  }

  if (user.friendship_status === "pending") {
    return { label: "Pending", disabled: true };
  }

  if (user.friendship_status) {
    return { label: "Unavailable", disabled: true };
  }

  return { label: "Add Friend", disabled: false };
}

export default function FriendSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchRequestId = useRef(0);
  const supabase = useMemo(() => createClient(), []);

  async function handleSearch(value) {
    setQuery(value);
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;

    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const { data, error } = await supabase.rpc("search_friend_candidates", {
      p_query: value,
      p_limit: 25,
    });

    if (requestId !== searchRequestId.current) {
      return;
    }

    if (error) {
      console.error("FRIEND SEARCH ERROR:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      setResults([]);
      toast.error("Could not search for friends.");
      setIsSearching(false);
      return;
    }

    setResults(data || []);
    setIsSearching(false);
  }

  function handleSendRequest(userId) {
    startTransition(async () => {
      const result = await sendFriendRequest(userId);

      if (result.success) {
        setResults((current) =>
          current.map((user) =>
            user.id === userId
              ? { ...user, friendship_status: "pending" }
              : user
          )
        );
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
            const location = [user.city, user.state].filter(Boolean).join(", ");
            const action = getFriendAction(user);

            return (
              <li key={user.id} className="friends-search__result">
                <Link
                  className="friends-search__profile"
                  href={`/profiles/${user.id}`}
                >
                  <Image
                    src={
                      user.avatar_cloudinary_url ||
                      DEFAULT_PROFILE_AVATAR_URL
                    }
                    alt=""
                    width={40}
                    height={40}
                    sizes="40px"
                  />
                  <span className="friends-search__identity">
                    <strong>{displayName}</strong>
                    {user.username && <span>@{user.username}</span>}
                    {location && (
                      <span className="friends-search__location">
                        {location}
                      </span>
                    )}
                  </span>
                </Link>

                <button
                  type="button"
                  disabled={isPending || action.disabled}
                  onClick={() => handleSendRequest(user.id)}
                >
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
