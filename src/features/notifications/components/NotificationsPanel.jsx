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

function getTrimmedText(value, maxLength = 140) {
  if (typeof value !== "string") {
    return "";
  }

  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function getPostLabel(post) {
  if (!post) {
    return "";
  }

  return (
    getTrimmedText(post.title, 120) ||
    getTrimmedText(post.body, 140)
  );
}

function getWarningPostId(notification) {
  const data = notification.metadata || notification.data || {};

  return data.post_id || notification.post_id || null;
}

function getWarningPostLabel(notification) {
  const data = notification.metadata || notification.data || {};

  return (
    getPostLabel(notification.relatedPost) ||
    getTrimmedText(data.post_title, 120) ||
    getTrimmedText(data.post_excerpt, 140)
  );
}

function ModerationWarningContent({ notification }) {
  const data = notification.metadata || notification.data || {};
  const warningMessage = getTrimmedText(
    data.message || (data.report_reason ? "" : data.reason),
    500,
  );
  const reportReason = getTrimmedText(data.report_reason);
  const warningPostId = getWarningPostId(notification);
  const hasRelatedPostReference = Boolean(
    warningPostId || data.report_id,
  );
  const relatedPostLabel = getWarningPostLabel(notification);
  const targetHref = warningPostId ? `/posts/${warningPostId}` : null;

  const hasNewWarningContext = Boolean(
    warningMessage || reportReason || hasRelatedPostReference,
  );

  if (!hasNewWarningContext) {
    return (
      <>
        You received a warning from TriggerFeed moderation.
        <time dateTime={notification.created_at}>
          {new Date(notification.created_at).toLocaleString()}
        </time>
      </>
    );
  }

  return (
    <div className="notifications-panel__warning">
      <p>You received a warning from TriggerFeed moderation.</p>

      {warningMessage ? (
        <p>
          <strong>Message:</strong> {warningMessage}
        </p>
      ) : null}

      {reportReason ? (
        <p>
          <strong>Reason:</strong> {reportReason}
        </p>
      ) : null}

      {hasRelatedPostReference ? (
        <p>
          <strong>Related post:</strong>{" "}
          {relatedPostLabel ? (
            <>
              {relatedPostLabel}
              {targetHref ? (
                <>
                  {" "}
                  <NotificationTargetLink
                    notificationId={notification.id}
                    href={targetHref}
                  >
                    View flagged post
                  </NotificationTargetLink>
                </>
              ) : null}
            </>
          ) : (
            "Related post unavailable"
          )}
        </p>
      ) : null}

      <time dateTime={notification.created_at}>
        {new Date(notification.created_at).toLocaleString()}
      </time>
    </div>
  );
}

export default function NotificationsPanel({ notifications = [] }) {
  if (!notifications.length) {
    return (
      <p className="notifications-panel__empty">No notifications right now.</p>
    );
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
          actionText = "You received a warning from TriggerFeed moderation.";
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
              {notification.type === "moderation_warning" ? (
                <ModerationWarningContent notification={notification} />
              ) : (
                <>
                  {notification.type?.startsWith("account_") ? null : (
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
                  ) : (
                    null
                  )}
                  <time dateTime={notification.created_at}>
                    {new Date(notification.created_at).toLocaleString()}
                  </time>
                </>
              )}
            </div>

            <DismissNotificationButton notificationId={notification.id} />
          </li>
        );
      })}
    </ul>
  );
}
