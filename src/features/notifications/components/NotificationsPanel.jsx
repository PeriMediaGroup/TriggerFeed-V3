import Link from "next/link";
import DismissNotificationButton from "@/features/notifications/components/DismissNotificationButton";
import NotificationTargetLink from "@/features/notifications/components/NotificationTargetLink";
import { icons } from "@/lib/icons";

const notificationIconMap = {
  comment: icons.comment,
  friend_accepted: icons.usercheck,
  friend_request: icons.userplus,
  mention: icons.mention,
  moderation_warning: icons.warning,
  account_muted: icons.warning,
  account_banned: icons.warning,
  account_unmuted: icons.notifications,
  account_unbanned: icons.notifications,
  reply: icons.reply,
};

function getNotificationIcon(type) {
  return notificationIconMap[type] || icons.notifications;
}

function getNotificationIconClass(type) {
  return `notifications-panel__icon notifications-panel__icon--${type || "default"}`;
}

export default function NotificationsPanel({ notifications = [] }) {
  if (!notifications.length) {
    return <p>No notifications right now.</p>;
  }

  return (
    <ul className="notifications-panel">
      {notifications.map((notification) => {
        const Icon = getNotificationIcon(notification.type);

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

        if (notification.type === "moderation_warning") {
          actionText = notification.metadata?.message
            ? `You received a warning from TriggerFeed moderation: ${notification.metadata.message}`
            : "You received a warning from TriggerFeed moderation.";
        }

        if (notification.type === "account_muted") {
          actionText = notification.metadata?.reason
            ? `Your TriggerFeed account has been muted. Reason: ${notification.metadata.reason}`
            : "Your TriggerFeed account has been muted.";
        }

        if (notification.type === "account_banned") {
          actionText = notification.metadata?.reason
            ? `Your TriggerFeed account has been banned. Reason: ${notification.metadata.reason}`
            : "Your TriggerFeed account has been banned.";
        }

        if (notification.type === "account_unmuted") {
          actionText = "Your TriggerFeed account has been unmuted.";
        }

        if (notification.type === "account_unbanned") {
          actionText = "Your TriggerFeed account has been unbanned.";
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
          targetHref = "/profile?tab=friends";
          targetLabel = "View request";
        }

        if (notification.type === "friend_accepted" && notification.actor_id) {
          targetHref = `/profiles/${notification.actor_id}`;
          targetLabel = "View profile";
        }

        if (
          notification.type === "moderation_warning" &&
          notification.post_id
        ) {
          targetHref = `/posts/${notification.post_id}`;
          targetLabel = "View post";
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
            <div className={getNotificationIconClass(notification.type)}>
              <Icon aria-hidden="true" size={20} strokeWidth={2.25} />
            </div>

            <div className="notifications-panel__content">
              {notification.type === "moderation_warning" ||
              notification.type?.startsWith("account_") ? null : (
                <>
                  {actorHref ? (
                    <Link href={actorHref}>{actorLabel}</Link>
                  ) : (
                    <span>{actorLabel}</span>
                  )}{" "}
                </>
              )}
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
