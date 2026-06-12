"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import {
  addAdminNote,
  banUser,
  muteUser,
  unbanUser,
  unmuteUser,
  updateUserRole,
} from "@/features/admin/actions/moderationActions";

const DEFAULT_AVATAR_URL =
  "https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png";

const ACTION_LABELS = {
  warn: "Warning",
  mute: "Muted",
  unmute: "Unmuted",
  ban: "Banned",
  unban: "Unbanned",
  remove_post: "Post removed",
  restore_post: "Post restored",
  dismiss_report: "Report dismissed",
  review_report: "Report reviewed",
  admin_note: "Admin note",
  promote_user: "Promoted",
  demote_user: "Demoted",
};

function getProfileName(profile) {
  return (
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username ||
    "Unknown user"
  );
}

function getPromptValue(label, fallback = "") {
  const value = window.prompt(label, fallback);

  if (value === null) {
    return null;
  }

  return value.trim();
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

function formatJoinedDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString();
}

function getStatusLabels(user) {
  const labels = [];

  if (user.is_deleted) {
    labels.push("Deleted");
  }

  if (user.is_banned) {
    labels.push("Banned");
  }

  if (user.is_muted) {
    labels.push("Muted");
  }

  return labels.length ? labels : ["Active"];
}

export default function AdminUserCard({ user, currentUserId, permissions }) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const displayName = getProfileName(user);
  const canModerate = permissions?.canModerate === true;
  const canBan = permissions?.canBan === true;
  const canManageRoles = permissions?.canManageRoles === true;
  const isSelf = user.id === currentUserId;
  const statusLabels = getStatusLabels(user);
  const historyCount = user.moderation_history?.length || 0;

  function runAction(action) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        toast.success(result.message || "User action completed.");
        return;
      }

      toast.error(result.message || "User action failed.");
    });
  }

  function handleAdminNote() {
    const note = getPromptValue("Admin note", "");

    if (note === null) {
      return;
    }

    runAction(() =>
      addAdminNote({
        targetUserId: user.id,
        note,
      }),
    );
  }

  function handleMuteUser() {
    const reason = getPromptValue("Mute reason", "");

    if (reason === null) {
      return;
    }

    runAction(() =>
      muteUser({
        targetUserId: user.id,
        reason,
      }),
    );
  }

  function handleUnmuteUser() {
    const reason = getPromptValue("Unmute reason", "");

    if (reason === null) {
      return;
    }

    runAction(() =>
      unmuteUser({
        targetUserId: user.id,
        reason,
      }),
    );
  }

  function handleBanUser() {
    const reason = getPromptValue("Ban reason", "");

    if (reason === null) {
      return;
    }

    if (!window.confirm("Ban this user?")) {
      return;
    }

    runAction(() =>
      banUser({
        targetUserId: user.id,
        reason,
      }),
    );
  }

  function handleUnbanUser() {
    const reason = getPromptValue("Unban reason", "");

    if (reason === null) {
      return;
    }

    runAction(() =>
      unbanUser({
        targetUserId: user.id,
        reason,
      }),
    );
  }

  function handleRoleChange(newRole) {
    const reason = getPromptValue(`Reason for changing role to ${newRole}`, "");

    if (reason === null) {
      return;
    }

    runAction(() =>
      updateUserRole({
        targetUserId: user.id,
        newRole,
        reason,
      }),
    );
  }

  return (
    <article className="admin-user-card">
      <div className="admin-user-card__summary">
        <Image
          src={user.avatar_cloudinary_url || DEFAULT_AVATAR_URL}
          alt={`${displayName} avatar`}
          width={40}
          height={40}
          className="admin-user-card__avatar"
        />

        <div className="admin-user-card__identity">
          <h2 className="admin-user-card__name">{displayName}</h2>
          <p className="admin-user-card__username">
            {user.username ? `@${user.username}` : "No username"}
          </p>
          {user.email ? (
            <p className="admin-user-card__email">{user.email}</p>
          ) : null}
        </div>

        <div className="admin-user-card__meta" aria-label="User metadata">
          <span className="admin-user-card__badge">{user.role || "user"}</span>
          {statusLabels.map((label) => (
            <span
              key={label}
              className={`admin-user-card__badge admin-user-card__badge--${label.toLowerCase()}`}
            >
              {label}
            </span>
          ))}
          <span className="admin-user-card__joined">
            Joined {formatJoinedDate(user.created_at)}
          </span>
        </div>

        {canModerate ? (
          <div className="admin-user-card__actions">
            <Link
              className="admin-user-card__action"
              href={`/profiles/${user.id}`}
            >
              View Profile
            </Link>

            <button
              type="button"
              className="admin-user-card__action"
              onClick={handleAdminNote}
              disabled={isPending}
            >
              Add Note
            </button>

            {user.is_muted ? (
              <button
                type="button"
                className="admin-user-card__action"
                onClick={handleUnmuteUser}
                disabled={isPending}
              >
                Unmute
              </button>
            ) : (
              <button
                type="button"
                className="admin-user-card__action"
                onClick={handleMuteUser}
                disabled={isPending}
              >
                Mute
              </button>
            )}

            {canBan &&
              (user.is_banned ? (
                <button
                  type="button"
                  className="admin-user-card__action"
                  onClick={handleUnbanUser}
                  disabled={isPending}
                >
                  Unban
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-user-card__action admin-user-card__action--danger"
                  onClick={handleBanUser}
                  disabled={isPending}
                >
                  Ban
                </button>
              ))}

            <button
              type="button"
              className="admin-user-card__action admin-user-card__history-toggle"
              onClick={() => setIsHistoryOpen((current) => !current)}
              aria-expanded={isHistoryOpen}
            >
              {isHistoryOpen
                ? "Hide History"
                : `Show History (${historyCount})`}
            </button>

            {canManageRoles && user.role !== "ceo" && !isSelf ? (
              <div
                className="admin-user-card__role-actions"
                aria-label="Role actions"
              >
                {user.role === "user" ? (
                  <button
                    type="button"
                    className="admin-user-card__action"
                    onClick={() => handleRoleChange("moderator")}
                    disabled={isPending}
                  >
                    Make Moderator
                  </button>
                ) : null}

                {user.role !== "admin" ? (
                  <button
                    type="button"
                    className="admin-user-card__action"
                    onClick={() => handleRoleChange("admin")}
                    disabled={isPending}
                  >
                    Make Admin
                  </button>
                ) : null}

                {user.role === "admin" ? (
                  <button
                    type="button"
                    className="admin-user-card__action"
                    onClick={() => handleRoleChange("moderator")}
                    disabled={isPending}
                  >
                    Demote to Moderator
                  </button>
                ) : null}

                {user.role !== "user" ? (
                  <button
                    type="button"
                    className="admin-user-card__action"
                    onClick={() => handleRoleChange("user")}
                    disabled={isPending}
                  >
                    Make User
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isHistoryOpen ? (
        <section
          className="admin-user-card__history"
          aria-label="Moderation history"
        >
          <h3>Moderation History</h3>

          {historyCount > 0 ? (
            <ul className="admin-user-card__history-list">
              {user.moderation_history.map((action) => (
                <li key={action.id} className="admin-user-card__history-item">
                  <div className="admin-user-card__history-header">
                    <div className="admin-user-card__offense">
                      <strong>
                        {ACTION_LABELS[action.action_type] ||
                          action.action_type}
                      </strong>
                      <p>&nbsp;
                        Reason : {" "}
                        {action.message || action.reason || "No note provided."}
                      </p>
                    </div>
                    <span>{formatDate(action.created_at)}</span>
                  </div>

                  <p className="admin-user-card__history-meta">
                    Actor: {getProfileName(action.actor || {})}
                    {action.related_post_id ? (
                      <Link href={`/posts/${action.related_post_id}`}>
                        Post
                      </Link>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-user-card__empty">No moderation history yet.</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
