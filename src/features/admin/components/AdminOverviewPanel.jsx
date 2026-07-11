import Image from "next/image";
import Link from "next/link";

import Icon from "@/components/ui/Icon";
import { icons } from "@/lib/icons";
import { formatDateTime, formatShortDate } from "@/lib/formatDate";

import AdminPageShell from "./AdminPageShell";

const DEFAULT_AVATAR_URL =
  "https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png";

const METRIC_CONFIG = [
  {
    key: "onlineNow",
    label: "Online Now",
    helper: "Seen in the last 10 minutes",
    icon: icons.activity,
  },
  {
    key: "active7Days",
    label: "Active - 7 Days",
    helper: "Users seen this week",
    icon: icons.usercheck,
  },
  {
    key: "new7Days",
    label: "New - 7 Days",
    helper: "Profiles created this week",
    icon: icons.userplus,
  },
  {
    key: "totalUsers",
    label: "Total Users",
    helper: "Registered non-deleted profiles",
    icon: icons.friends,
  },
];

function formatMetric(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function getDisplayName(user) {
  return user.displayName || user.username || "Unknown user";
}

function formatRelativeActivity(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 10) {
    return "Active now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffHours < 48) {
    return "Yesterday";
  }

  const diffDays = Math.floor(diffHours / 24);

  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function StatusBadges({ user }) {
  const badges = [
    user.isMuted ? "Muted" : null,
    user.isBanned ? "Banned" : null,
    user.isDeleted ? "Deleted" : null,
  ].filter(Boolean);

  if (!badges.length) {
    return null;
  }

  return (
    <span className="admin-overview__status-badges">
      {badges.map((badge) => (
        <span
          key={badge}
          className={`admin-user-card__badge admin-user-card__badge--${badge.toLowerCase()}`}
        >
          {badge}
        </span>
      ))}
    </span>
  );
}

export default function AdminOverviewPanel({
  adminCounts = null,
  overview,
  overviewError = null,
}) {
  const openPostReports = adminCounts?.reports ?? 0;
  const openAbuseReports = adminCounts?.abuseReports ?? 0;

  return (
    <AdminPageShell
      activeSection="overview"
      counts={adminCounts}
      eyebrow="Administration"
      title="Control Panel"
      summary="Monitor activity, manage users, and review reports."
    >
      <section className="admin-overview">
        {overviewError ? (
          <p className="admin-users__notice">
            Could not load activity metrics.
          </p>
        ) : null}

        <div className="admin-overview__metrics">
          {METRIC_CONFIG.map((metric) => (
            <article key={metric.key} className="admin-overview__metric-card">
              <span className="admin-overview__metric-icon">
                <Icon icon={metric.icon} size={20} />
              </span>
              <div>
                <p className="admin-overview__metric-label">{metric.label}</p>
                <p className="admin-overview__metric-value">
                  {formatMetric(overview?.[metric.key])}
                </p>
                <p className="admin-overview__metric-helper">{metric.helper}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="admin-overview__nav-cards">
          <article className="admin-overview__nav-card">
            <div className="admin-overview__nav-card-heading">
              <Icon icon={icons.report} size={20} />
              <h2>Reports</h2>
            </div>
            <p>
              {formatMetric(openPostReports)} open post report
              {openPostReports === 1 ? "" : "s"}
              {openAbuseReports > 0
                ? `, ${formatMetric(openAbuseReports)} open abuse report${openAbuseReports === 1 ? "" : "s"}`
                : ""}
            </p>
            <Link className="admin-overview__button" href="/admin/reports">
              Open Reports
            </Link>
          </article>

          <article className="admin-overview__nav-card">
            <div className="admin-overview__nav-card-heading">
              <Icon icon={icons.friends} size={20} />
              <h2>Users</h2>
            </div>
            <p>
              {formatMetric(overview?.totalUsers)} total users,{" "}
              {formatMetric(overview?.active7Days)} active in the last 7 days
            </p>
            <Link className="admin-overview__button" href="/admin/users">
              Manage Users
            </Link>
          </article>
        </div>

        <section className="admin-overview__recent" aria-labelledby="recent-activity-heading">
          <div className="admin-overview__section-heading">
            <h2 id="recent-activity-heading">Recent Activity</h2>
            <p>Latest authenticated web sessions.</p>
          </div>

          {overview?.recentUsers?.length ? (
            <div className="admin-overview__recent-list">
              {overview.recentUsers.map((user) => {
                const displayName = getDisplayName(user);
                const exactLastSeen = formatDateTime(user.lastSeenAt);

                return (
                  <article key={user.userId} className="admin-overview__recent-row">
                    <Image
                      src={user.avatarUrl || DEFAULT_AVATAR_URL}
                      alt={`${displayName} avatar`}
                      width={40}
                      height={40}
                      className="admin-user-card__avatar"
                    />
                    <div className="admin-overview__recent-identity">
                      <h3>{displayName}</h3>
                      <p>{user.username ? `@${user.username}` : "No username"}</p>
                    </div>
                    <div className="admin-user-card__meta">
                      <span className="admin-user-card__badge">{user.role}</span>
                      <StatusBadges user={user} />
                    </div>
                    <div className="admin-overview__recent-time">
                      <time dateTime={user.lastSeenAt || undefined} title={exactLastSeen}>
                        {formatRelativeActivity(user.lastSeenAt)}
                      </time>
                      <span>Joined {formatShortDate(user.joinedAt) || "Unknown"}</span>
                    </div>
                    <Link
                      className="admin-user-card__action"
                      href={`/profiles/${user.userId}`}
                    >
                      View Profile
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="admin-users__empty">No recent user activity yet.</p>
          )}
        </section>
      </section>
    </AdminPageShell>
  );
}
