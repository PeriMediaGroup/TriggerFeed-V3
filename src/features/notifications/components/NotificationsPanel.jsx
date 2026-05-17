import Link from "next/link";
import DismissNotificationButton from "@/features/notifications/components/DismissNotificationButton";
import NotificationTargetLink from "@/features/notifications/components/NotificationTargetLink";

export default function NotificationsPanel({ notifications = [] }) {
  if (!notifications.length) {
    return <p>No notifications right now.</p>;
  }

  return (
    <ul className="notifications-panel">
      {notifications.map((notification) => {
        const actorLabel = notification.actor?.username
          ? `@${notification.actor.username}`
          : notification.actor?.first_name
            ? notification.actor.first_name
            : "Someone";

        const actorHref = notification.actor_id
          ? `/profiles/${notification.actor_id}`
          : null;

        let actionText = notification.body || "sent you a notification";

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

          targetLabel = notification.comment_id ? "View comment" : "View post";
        }

        if (notification.type === "friend_request") {
          targetHref = "/profile/friends";
          targetLabel = "View request";
        }

        if (notification.type === "friend_accepted" && notification.actor_id) {
          targetHref = `/profiles/${notification.actor_id}`;
          targetLabel = "View profile";
        }

        return (
          <li
            key={notification.id}
            className={
              notification.is_read
                ? "notifications-panel__item"
                : "notifications-panel__item notifications-panel__item--unread"
            }
          >
            <div className="notifications-panel__content">
              <p>
                {actorHref ? (
                  <Link href={actorHref}>{actorLabel}</Link>
                ) : (
                  <span>{actorLabel}</span>
                )}

                {" "}
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
            </div>

            <DismissNotificationButton notificationId={notification.id} />
          </li>
        );
      })}
    </ul>
  );
}