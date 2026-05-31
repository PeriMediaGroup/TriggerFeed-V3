// src/app/profile/notifications/page.jsx

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationsReadMarker from "@/features/notifications/components/NotificationsReadMarker";
import NotificationsPanel from "@/features/notifications/components/NotificationsPanel";

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="profile-notifications-page">
        <h1>Notifications</h1>
        <p>You must be logged in to view notifications.</p>
        <Link href="/login">Log in</Link>
      </main>
    );
  }

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select(
      `
        id,
        user_id,
        actor_id,
        type,
        title,
        body,
        is_read,
        read_at,
        dismissed_at,
        created_at,
        post_id,
        comment_id,
        friend_id,
        metadata
      `,
    )
    .eq("user_id", user.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    logSupabaseError("GET NOTIFICATIONS ERROR:", error);

    return (
      <main className="profile-notifications-page">
        <NotificationsReadMarker />
        <h1>Notifications</h1>
        <p>Could not load notifications.</p>
      </main>
    );
  }

  const actorIds = [
    ...new Set(
      notifications
        ?.map((notification) => notification.actor_id)
        .filter(Boolean),
    ),
  ];

  const { data: actors, error: actorsError } = actorIds.length
    ? await supabase.rpc("get_public_profile_cards", {
        p_profile_ids: actorIds,
      })
    : { data: [], error: null };

  if (actorsError) {
    logSupabaseError("GET NOTIFICATION ACTORS ERROR:", actorsError);
  }

  const actorsById = new Map(actors?.map((actor) => [actor.id, actor]) ?? []);

  return (
    <main className="profile-notifications-page">
      <NotificationsReadMarker />
      <header className="profile-notifications-page__header">
        <h1>Notifications</h1>
        <Link href="/profile/friends">Friends</Link>
      </header>

      <NotificationsPanel
        notifications={
          notifications?.map((notification) => ({
            ...notification,
            actor: actorsById.get(notification.actor_id) ?? null,
          })) ?? []
        }
      />
    </main>
  );
}
