"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import {
  addAdminNote,
  banUser,
  dismissReport,
  escalateReport,
  muteUser,
  removePost,
  recommendBan,
  restorePost,
  reviewReport,
  unbanUser,
  unmuteUser,
  warnUser,
} from "@/features/admin/actions/moderationActions";

const STATUS_LABELS = {
  open: "Open",
  pending: "Pending",
  under_review: "Under review",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  actioned: "Actioned",
  warned: "Warned",
  post_removed: "Post removed",
  escalated: "Escalated",
  muted: "Muted",
  ban_recommended: "Ban recommended",
  banned: "Banned",
};

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
  escalate_report: "Report escalated",
  recommend_ban: "Ban recommended",
  admin_note: "Admin note",
  promote_user: "Promoted",
  demote_user: "Demoted",
  role_changed: "Role changed",
};

const ACTIONABLE_REPORT_STATUSES = new Set([
  "open",
  "pending",
  "under_review",
  "escalated",
  "ban_recommended",
]);

function getProfileName(profile) {
  if (!profile) {
    return "Unknown user";
  }

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

function getTextPreview(value, maxLength = 120) {
  if (!value) {
    return "No text provided.";
  }

  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function normalizeRunActionOptions(options) {
  if (!options) {
    return {
      optimisticStatus: null,
      onSuccess: null,
      pendingLabel: "",
    };
  }

  if (typeof options === "string") {
    return {
      optimisticStatus: options,
      onSuccess: null,
      pendingLabel: "",
    };
  }

  if (typeof options === "object") {
    return {
      optimisticStatus: options.optimisticStatus ?? null,
      onSuccess:
        typeof options.onSuccess === "function" ? options.onSuccess : null,
      pendingLabel:
        typeof options.pendingLabel === "string" ? options.pendingLabel : "",
    };
  }

  return {
    optimisticStatus: null,
    onSuccess: null,
    pendingLabel: "",
  };
}

export default function ReportCard({ report, permissions }) {
  const [status, setStatus] = useState(report.status || "open");
  const [isPostRemoved, setIsPostRemoved] = useState(
    report.post?.is_deleted === true || Boolean(report.post?.removed_at),
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [isPending, startTransition] = useTransition();

  const reporterName = getProfileName(report.reporter);
  const reviewerName = getProfileName(report.reviewer);
  const authorName = getProfileName(report.post_author);
  const postTitle = report.post?.title || "Untitled post";
  const reportedPostId = report.post?.id || report.post_id || null;
  const targetUserId = report.post?.user_id || null;
  const targetRole =
    typeof report.post_author?.role === "string"
      ? report.post_author.role.trim().toLowerCase()
      : null;
  const targetRoleLabel = targetRole || "Unknown";
  const postRemoved = isPostRemoved;
  const actorRole = permissions?.role || "user";
  const canModerate = permissions?.canModerate === true;
  const canBan = permissions?.canBan === true;
  const canMute = permissions?.canMute === true;
  const canCeoRestore = actorRole === "ceo";
  const canTargetForModerator =
    actorRole === "moderator" && targetRole === "user";
  const canTargetForAdmin =
    actorRole === "admin" && ["user", "moderator"].includes(targetRole);
  const canTargetForCeo = actorRole === "ceo" && targetRole !== "ceo";
  const canTargetUser = Boolean(
    targetUserId &&
      (canTargetForModerator || canTargetForAdmin || canTargetForCeo),
  );
  const canRemovePost =
    canTargetUser && ["moderator", "admin", "ceo"].includes(actorRole);
  const isActionableReport = ACTIONABLE_REPORT_STATUSES.has(status);
  const historyCount = report.moderation_history?.length || 0;

  function runAction(action, options = null) {
    const { optimisticStatus, onSuccess, pendingLabel } =
      normalizeRunActionOptions(options);

    startTransition(async () => {
      setActiveAction(pendingLabel || "Working...");

      try {
        const result = await action();

        if (result.ok) {
          if (optimisticStatus) {
            setStatus(optimisticStatus);
          }

          if (onSuccess) {
            onSuccess();
          }

          toast.success(result.message || "Moderation action completed.");
          return;
        }

        toast.error(result.message || "Moderation action failed.");
      } finally {
        setActiveAction("");
      }
    });
  }

  function handleReview() {
    const reason = getPromptValue("Review note", "");

    if (reason === null) {
      return;
    }

    runAction(
      () =>
        reviewReport({
          reportId: report.id,
          reason,
        }),
      "under_review",
    );
  }

  function handleDismiss() {
    const reason = getPromptValue("Dismissal reason", "");

    if (reason === null) {
      return;
    }

    runAction(
      () =>
        dismissReport({
          reportId: report.id,
          reason,
        }),
      "dismissed",
    );
  }

  function handleEscalate() {
    const reason = getPromptValue("Escalation reason", report.reason || "");

    if (reason === null) {
      return;
    }

    runAction(
      () =>
        escalateReport({
          reportId: report.id,
          reason,
        }),
      "escalated",
    );
  }

  function handleRecommendMute() {
    const reason = getPromptValue(
      "Reason for recommending mute",
      report.reason || "",
    );

    if (reason === null) {
      return;
    }

    runAction(
      () =>
        escalateReport({
          reportId: report.id,
          reason: `Mute recommended: ${reason}`,
        }),
      "escalated",
    );
  }

  function handleRecommendBan() {
    const reason = getPromptValue(
      "Reason for recommending ban",
      report.reason || "",
    );

    if (reason === null) {
      return;
    }

    runAction(
      () =>
        recommendBan({
          reportId: report.id,
          reason,
        }),
      "ban_recommended",
    );
  }

  function handleRemovePost() {
    const reason = getPromptValue("Reason for removing this post", "");

    if (reason === null) {
      return;
    }

    if (
      !window.confirm(
        "Remove this post?\n\nThis will hide the post from public feeds.",
      )
    ) {
      return;
    }

    runAction(
      () =>
        removePost({
          postId: reportedPostId,
          reason,
          relatedReportId: report.id,
        }),
      {
        optimisticStatus: "post_removed",
        onSuccess: () => setIsPostRemoved(true),
        pendingLabel: "Removing...",
      },
    );
  }

  function handleRestorePost() {
    const reason = getPromptValue("Restore note", "");

    if (reason === null) {
      return;
    }

    if (
      !window.confirm(
        "Restore post?\n\nThis will make the post visible again if it is otherwise allowed by normal visibility rules.",
      )
    ) {
      return;
    }

    runAction(
      () =>
        restorePost({
          postId: reportedPostId,
          reason,
          relatedReportId: report.id,
        }),
      {
        optimisticStatus: "reviewed",
        onSuccess: () => setIsPostRemoved(false),
        pendingLabel: "Restoring...",
      },
    );
  }

  function handleWarnUser() {
    const reason = getPromptValue("Warning reason", report.reason || "");

    if (reason === null) {
      return;
    }

    const message = getPromptValue("Warning message", "");

    if (message === null) {
      return;
    }

    runAction(
      () =>
        warnUser({
          targetUserId,
          reason,
          message,
          relatedPostId: reportedPostId,
          relatedReportId: report.id,
        }),
      {
        pendingLabel: "Sending...",
      },
    );
  }

  function handleMuteUser() {
    const reason = getPromptValue("Mute reason", report.reason || "");

    if (reason === null) {
      return;
    }

    runAction(() =>
      muteUser({
        targetUserId,
        reason,
        relatedPostId: reportedPostId,
        relatedReportId: report.id,
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
        targetUserId,
        reason,
      }),
    );
  }

  function handleBanUser() {
    const reason = getPromptValue("Ban reason", report.reason || "");

    if (reason === null) {
      return;
    }

    if (!window.confirm("Ban this user?")) {
      return;
    }

    runAction(() =>
      banUser({
        targetUserId,
        reason,
        relatedPostId: reportedPostId,
        relatedReportId: report.id,
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
        targetUserId,
        reason,
      }),
    );
  }

  function handleAdminNote() {
    const note = getPromptValue("Admin note", "");

    if (note === null) {
      return;
    }

    runAction(() =>
      addAdminNote({
        targetUserId,
        note,
        relatedPostId: reportedPostId,
        relatedReportId: report.id,
      }),
    );
  }

  return (
    <article
      className={`report-card report-card--compact report-card--${status}`}
    >
      <div className="report-card__summary">
        <header className="report-card__header">
          <span className="report-card__status">
            {postRemoved ? "Post removed" : STATUS_LABELS[status] || status}
          </span>
          <div className="report-card__heading">
            <p className="report-card__eyebrow">Post report</p>
            <h3 className="report-card__title">{postTitle}</h3>
            <p className="report-card__preview">
              {getTextPreview(
                report.post?.body || report.details || report.reason,
              )}
            </p>
          </div>
        </header>

        <div className="report-card__meta" aria-label="Report summary">
          <span className="report-card__meta-item">
            Reason: {getTextPreview(report.reason, 60)}
          </span>
          <span className="report-card__meta-item">
            Reporter: {reporterName}
          </span>
          <span className="report-card__meta-item">
            Author: {authorName}
          </span>
          <span className="report-card__meta-item">
            Author role: {targetRoleLabel}
          </span>
          {postRemoved ? (
            <span className="report-card__meta-item">Status: Post removed</span>
          ) : null}
          <span className="report-card__meta-item">
            Reported: {formatDate(report.created_at)}
          </span>
          {report.reviewed_at ? (
            <span className="report-card__meta-item">
              Reviewed: {reviewerName} on {formatDate(report.reviewed_at)}
            </span>
          ) : null}
        </div>

        {canModerate ? (
          <div className="report-card__actions">
            {isActionableReport ? (
              <>
                <button
                  type="button"
                  className="report-card__action"
                  onClick={handleReview}
                  disabled={isPending}
                >
                  Under review
                </button>

                <button
                  type="button"
                  className="report-card__action"
                  onClick={handleEscalate}
                  disabled={isPending}
                >
                  Escalate
                </button>

                <button
                  type="button"
                  className="report-card__action"
                  onClick={handleDismiss}
                  disabled={isPending}
                >
                  Dismiss
                </button>

                <button
                  type="button"
                  className="report-card__action report-card__action--danger"
                  onClick={handleRemovePost}
                  disabled={
                    isPending || !reportedPostId || postRemoved || !canRemovePost
                  }
                >
                  {activeAction === "Removing..." ? "Removing..." : "Remove post"}
                </button>

                <button
                  type="button"
                  className="report-card__action"
                  onClick={handleWarnUser}
                  disabled={isPending || !canTargetUser}
                >
                  {activeAction === "Sending..." ? "Sending..." : "Warn user"}
                </button>

                {canMute && report.post_author?.is_muted ? (
                  <button
                    type="button"
                    className="report-card__action"
                    onClick={handleUnmuteUser}
                    disabled={isPending || !canTargetUser || !canMute}
                  >
                    Unmute user
                  </button>
                ) : canMute ? (
                  <button
                    type="button"
                    className="report-card__action"
                    onClick={handleMuteUser}
                    disabled={isPending || !canTargetUser || !canMute}
                  >
                    Mute user
                  </button>
                ) : (
                  <button
                    type="button"
                    className="report-card__action"
                    onClick={handleRecommendMute}
                    disabled={isPending}
                  >
                    Recommend mute
                  </button>
                )}

                {canBan &&
                  (report.post_author?.is_banned ? (
                    <button
                      type="button"
                      className="report-card__action"
                      onClick={handleUnbanUser}
                      disabled={isPending || !canTargetUser}
                    >
                      Unban user
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="report-card__action report-card__action--danger"
                      onClick={handleBanUser}
                      disabled={isPending || !canTargetUser}
                    >
                      Ban user
                    </button>
                  ))}
                {!canBan ? (
                  <button
                    type="button"
                    className="report-card__action"
                    onClick={handleRecommendBan}
                    disabled={isPending}
                  >
                    Recommend ban
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {report.post?.id ? (
                  <Link
                    className="report-card__action"
                    href={`/posts/${report.post.id}`}
                  >
                    View Post
                  </Link>
                ) : null}
                {canCeoRestore && postRemoved && reportedPostId ? (
                  <button
                    type="button"
                    className="report-card__action"
                    onClick={handleRestorePost}
                    disabled={isPending}
                  >
                    {activeAction === "Restoring..."
                      ? "Restoring..."
                      : "Restore post"}
                  </button>
                ) : null}
              </>
            )}

            <button
              type="button"
              className="report-card__action"
              onClick={handleAdminNote}
              disabled={isPending || !targetUserId}
            >
              Add Admin Note
            </button>

            <button
              type="button"
              className="report-card__action report-card__toggle"
              onClick={() => setIsDetailsOpen((current) => !current)}
              aria-expanded={isDetailsOpen}
            >
              {isDetailsOpen ? "Hide Details" : "Details"}
            </button>

            <button
              type="button"
              className="report-card__action report-card__toggle"
              onClick={() => setIsHistoryOpen((current) => !current)}
              aria-expanded={isHistoryOpen}
            >
              {isHistoryOpen ? "Hide History" : `History (${historyCount})`}
            </button>
          </div>
        ) : null}
      </div>

      {isDetailsOpen ? (
        <section className="report-card__details" aria-label="Report details">
          <dl className="report-card__details-list">
            <div className="report-card__detail">
              <dt>Reason</dt>
              <dd>{report.reason}</dd>
            </div>

            {report.details && (
              <div className="report-card__detail">
                <dt>Details</dt>
                <dd>{report.details}</dd>
              </div>
            )}

            <div className="report-card__detail">
              <dt>Reported by</dt>
              <dd>
                {report.reporter?.id ? (
                  <Link href={`/profiles/${report.reporter.id}`}>
                    {reporterName}
                  </Link>
                ) : (
                  reporterName
                )}
                <span> on {formatDate(report.created_at)}</span>
              </dd>
            </div>

            <div className="report-card__detail">
              <dt>Post author</dt>
              <dd>
                {targetUserId ? (
                  <Link href={`/profiles/${targetUserId}`}>{authorName}</Link>
                ) : (
                  authorName
                )}
                <span className="report-card__meta-item">
                  Role: {targetRoleLabel}
                  {report.post_author?.is_muted ? " | Muted" : ""}
                  {report.post_author?.is_banned ? " | Banned" : ""}
                </span>
              </dd>
            </div>

            {report.post?.id && (
              <div className="report-card__detail">
                <dt>Post</dt>
                <dd>
                  <Link href={`/posts/${report.post.id}`}>
                    View reported post
                  </Link>
                  {postRemoved ? (
                    <span className="report-card__meta-item">Removed</span>
                  ) : null}
                </dd>
              </div>
            )}

            {report.reviewed_at && (
              <div className="report-card__detail">
                <dt>Reviewed by</dt>
                <dd>
                  {reviewerName}
                  <span> on {formatDate(report.reviewed_at)}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>
      ) : null}

      {isHistoryOpen ? (
        <section className="report-card__history" aria-label="Moderation history">
          <h4>Recent moderation history</h4>

          {historyCount > 0 ? (
            <ul className="report-card__history-list">
              {report.moderation_history.map((action) => (
                <li key={action.id} className="report-card__history-item">
                  <div className="report-card__history-header">
                    <strong>
                      {ACTION_LABELS[action.action_type] || action.action_type}
                    </strong>
                    <span>{formatDate(action.created_at)}</span>
                  </div>

                  <p>
                    {action.message || action.reason || "No note provided."}
                  </p>

                  <p className="report-card__history-meta">
                    Actor: {getProfileName(action.actor)}
                    {action.related_post_id ? (
                      <Link href={`/posts/${action.related_post_id}`}>Post</Link>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="report-card__empty">No moderation history yet.</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
