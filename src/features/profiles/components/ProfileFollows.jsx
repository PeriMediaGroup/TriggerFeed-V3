"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FriendsList from "@/features/friends/components/FriendsList";

export default function ProfileFollows({ profileId }) {
  const [summary, setSummary] = useState(null);
  const [viewerId, setViewerId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState(null);
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const request = useRef(0);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc("get_profile_follow_summary", { p_profile_id: profileId }),
      supabase.auth.getUser(),
    ]).then(([result, auth]) => {
      if (!active) return;
      if (result.error) setError("Could not load follows. Please reload to retry.");
      else setSummary(result.data);
      setViewerId(auth.data.user?.id || null);
    }).catch(() => { if (active) setError("Could not load follows. Please reload to retry."); });
    return () => { active = false; request.current += 1; };
  }, [profileId, supabase]);

  async function toggleFollow() {
    if (busy || !summary) return;
    setBusy(true); setError("");
    try {
      const result = await supabase.rpc("set_profile_follow", { p_profile_id: profileId, p_follow: !summary.is_following });
      if (result.error) throw result.error;
      const refreshed = await supabase.rpc("get_profile_follow_summary", { p_profile_id: profileId });
      if (refreshed.error) throw refreshed.error;
      setSummary(refreshed.data);
      setDirection(null); request.current += 1;
    } catch { setError("Could not update follows. Please retry."); }
    finally { setBusy(false); }
  }

  async function loadList(nextDirection, append = false) {
    const version = ++request.current;
    setBusy(true); setError(""); setDirection(nextDirection);
    if (!append) setRows([]);
    try {
      const result = await supabase.rpc("get_profile_follow_list", {
        p_profile_id: profileId, p_direction: nextDirection, p_offset: append ? rows.length : 0, p_limit: 25,
      });
      if (result.error) throw result.error;
      if (version !== request.current) return;
      setRows((old) => append ? [...old, ...result.data] : result.data);
      setMore(result.data.length === 25);
    } catch { if (version === request.current) setError("Could not load this list. Please retry."); }
    finally { if (version === request.current) setBusy(false); }
  }

  return <section className="profile-follows" aria-label="Profile follows" aria-busy={busy}>
    {error && <p role="alert">{error}</p>}
    {!summary && !error && <p role="status">Loading follows…</p>}
    {summary && <div className="profile-follows__actions">
      <button disabled={busy} onClick={() => loadList("followers")}>{summary.followers} Followers</button>
      <button disabled={busy} onClick={() => loadList("following")}>{summary.following} Following</button>
      {viewerId && viewerId !== profileId && <button disabled={busy} aria-pressed={summary.is_following} onClick={toggleFollow}>{summary.is_following ? "Unfollow" : "Follow"}</button>}
      {!viewerId && <Link href="/login">Log in to follow</Link>}
    </div>}
    {direction && <div className="profile-follows__list">
      <button disabled={busy} onClick={() => { setDirection(null); request.current += 1; }}>Close list</button>
      {busy && <p role="status">Loading…</p>}
      <FriendsList title={direction === "followers" ? "Followers" : "Following"} emptyMessage={busy ? "Loading profiles…" : "No profiles to show."} friends={rows.map((row) => ({ id: row.id, otherUser: row }))} />
      {more && <button disabled={busy} onClick={() => loadList(direction, true)}>Load more</button>}
    </div>}
  </section>;
}
