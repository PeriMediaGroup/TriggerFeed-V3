// src/app/profile/page.jsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/features/profiles/data/getCurrentProfile";
import { getProfileStats } from "@/features/profiles/data/getProfileStats";
import { getLatestPost } from "@/features/profiles/data/getLatestPost";
import { getTopFriends } from "@/features/profiles/data/getTopFriends";
import { getTopGuns } from "@/features/profiles/data/getTopGuns";

import ProfileHeader from "@/features/profiles/components/ProfileHeader";
import { getFriendDashboard } from "@/features/friends/data/getFriendDashboard";
import { getAcceptedFriends } from "@/features/friends/data/getAcceptedFriends";
import ProfileDashboardTabs from "@/features/profiles/components/ProfileDashboardTabs";
import FriendsPanel from "@/features/friends/components/FriendsPanel";
import ManageGunsPanel from "@/features/guns/components/ManageGunsPanel";
import NotificationsPanel from "@/features/notifications/components/NotificationsPanel";
import ProfileSettings from "@/features/profiles/components/ProfileSettings";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { profile, error } = await getCurrentProfile();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="profile-page">
        <h1>Profile</h1>
        <p>You must be logged in to view your profile.</p>
      </main>
    );
  }

  const { data: notificationSettings } = await supabase
  .from("notification_settings")
  .select(
    `
    mentions_enabled,
    comments_enabled,
    friend_requests_enabled,
    friend_accepts_enabled
  `,
  )
  .eq("user_id", user.id)
  .maybeSingle();

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .is("dismissed_at", null);

  if (error || !profile) {
    redirect("/login");
  }

  const { data: notifications } = await supabase
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

  const actorIds = [
    ...new Set(
      notifications
        ?.map((notification) => notification.actor_id)
        .filter(Boolean),
    ),
  ];

  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, first_name")
        .in("id", actorIds)
    : { data: [] };

  const actorsById = new Map(actors?.map((actor) => [actor.id, actor]) ?? []);

  const notificationsWithActors =
    notifications?.map((notification) => ({
      ...notification,
      actor: actorsById.get(notification.actor_id) ?? null,
    })) ?? [];

  const [
    { stats },
    { latestPost },
    { topFriends },
    { topGuns },
    friendDashboard,
    { acceptedFriends },
  ] = await Promise.all([
    getProfileStats(profile.id),
    getLatestPost(profile.id),
    getTopFriends(profile.id),
    getTopGuns(profile.id),
    getFriendDashboard(),
    getAcceptedFriends(),
  ]);

  const incomingRequests = friendDashboard?.incomingRequests ?? [];
  const outgoingRequests = friendDashboard?.outgoingRequests ?? [];
  const friends = friendDashboard?.friends ?? [];

  return (
    <main className="profile">
      <ProfileHeader
        profile={profile}
        stats={stats}
        isCurrentUser
        unreadNotifications={unreadNotifications ?? 0}
      />

      <ProfileDashboardTabs
        tabs={[
          {
            key: "notifications",
            label: "Notifications",
            badge: unreadNotifications ?? 0,
            panel: (
              <NotificationsPanel notifications={notificationsWithActors} />
            ),
          },
          {
            key: "friends",
            label: "Friends",
            panel: (
              <FriendsPanel
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
                friends={friends}
                acceptedFriends={acceptedFriends}
                topFriends={topFriends}
              />
            ),
          },
          {
            key: "guns",
            label: "Top Guns",
            panel: <ManageGunsPanel topGuns={topGuns} />,
          },
          {
            key: "settings",
            label: "Settings",
            panel: (
              <ProfileSettings
                profile={profile}
                notificationSettings={notificationSettings}
              />
            ),
          },
        ]}
      />
    </main>
  );
}
