// src/app/profile/notifications/page.jsx

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NotificationsReadMarker from "@/features/notifications/components/NotificationsReadMarker";
import DismissNotificationButton from "@/features/notifications/components/DismissNotificationButton";
import NotificationTargetLink from "@/features/notifications/components/NotificationTargetLink";

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
    console.error("GET NOTIFICATIONS ERROR:", error);

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
    ? await supabase
        .from("profiles")
        .select("id, username, first_name, last_name, avatar_cloudinary_url")
        .in("id", actorIds)
    : { data: [], error: null };

  if (actorsError) {
    console.error("GET NOTIFICATION ACTORS ERROR:", actorsError);
  }

  const actorsById = new Map(actors?.map((actor) => [actor.id, actor]) ?? []);

  return (
    <main className="profile-notifications-page">
      <NotificationsReadMarker />
      <header className="profile-notifications-page__header">
        <h1>Notifications</h1>
        <Link href="/profile/friends">Friends</Link>
      </header>

      {!notifications?.length ? (
        <p>No notifications at this time.</p>
      ) : (
        <ul className="profile-notifications-page__list">
          {notifications.map((notification) => {
            const actor = actorsById.get(notification.actor_id);

            const actorLabel = actor?.username
              ? `@${actor.username}`
              : actor?.first_name
                ? actor.first_name
                : "Someone";

            const actorHref = notification.actor_id
              ? `/profiles/${notification.actor_id}`
              : null;

            let actionText = notification.body;

            if (notification.type === "friend_request") {
              actionText = "sent you a friend request";
            }

            if (notification.type === "friend_accepted") {
              actionText = "accepted your friend request";
            }

            if (notification.type === "mention") {
              actionText = notification.comment_id
                ? "mentioned you in a comment"
                : "mentioned you in a post";
            }

            if (notification.type === "comment") {
              actionText = "commented on your post";
            }

            if (notification.type === "reply") {
              actionText = "replied to your comment";
            }

            let targetHref = null;
            let targetLabel = null;

            if (
              ["mention", "comment", "reply"].includes(notification.type) &&
              notification.post_id
            ) {
              targetHref = notification.comment_id
                ? `/posts/${notification.post_id}#comment-${notification.comment_id}`
                : `/posts/${notification.post_id}`;

              targetLabel = notification.comment_id
                ? "View comment"
                : "View post";
            }

            if (notification.type === "friend_request") {
              targetHref = "/profile/friends";
              targetLabel = "View request";
            }

            if (
              notification.type === "friend_accepted" &&
              notification.actor_id
            ) {
              targetHref = `/profiles/${notification.actor_id}`;
              targetLabel = "View profile";
            }

            return (
              <li
                key={notification.id}
                className={
                  notification.is_read
                    ? "profile-notifications-page__item"
                    : "profile-notifications-page__item profile-notifications-page__item--unread"
                }
              >
                <p>
                  {actorHref ? (
                    <Link
                      href={actorHref}
                      className="profile-notifications-page__actor"
                    >
                      {actorLabel}
                    </Link>
                  ) : (
                    <span>{actorLabel}</span>
                  )}{" "}
                  {actionText}
                  {targetHref && targetLabel ? (
                    <>
                      {" "}
                      <NotificationTargetLink
                        notificationId={notification.id}
                        href={targetHref}
                      >
                        {targetLabel}
                      </NotificationTargetLink>
                    </>
                  ) : null}
                </p>

                <time dateTime={notification.created_at}>
                  {new Date(notification.created_at).toLocaleString()}
                </time>
                <DismissNotificationButton notificationId={notification.id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
