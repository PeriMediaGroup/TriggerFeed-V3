"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { updatePostReportStatus } from "../actions/updatePostReportStatus";

const STATUS_LABELS = {
  open: "Open",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  actioned: "Actioned",
};

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

export default function ReportCard({ report }) {
  const [status, setStatus] = useState(report.status || "open");
  const [isPending, startTransition] = useTransition();

  const reporterName = getProfileName(report.reporter);
  const reviewerName = getProfileName(report.reviewer);
  const postTitle = report.post?.title || "Untitled post";

  function handleStatusChange(nextStatus) {
    startTransition(async () => {
      const result = await updatePostReportStatus({
        reportId: report.id,
        status: nextStatus,
      });

      if (result.ok) {
        setStatus(nextStatus);
        toast.success(result.message || "Report status updated.");
        return;
      }

      toast.error(result.message || "Could not update report status.");
    });
  }

  return (
    <article className={`report-card report-card--${status}`}>
      <header className="report-card__header">
        <div>
          <p className="report-card__eyebrow">Post report</p>
          <label>
            <strong>Post Title :</strong>
          </label>{" "}
          {postTitle}
        </div>

        <span className="report-card__status">
          <label>
            <strong>Status :</strong>
          </label>{" "}
          {STATUS_LABELS[status] || status}
        </span>
      </header>

      <div className="report-card__body">
        <p>
          <strong>Reason:</strong> {report.reason}
        </p>
        <p>
          {report.details && (
            <>
              <strong>Details:</strong> {report.details}
            </>
          )}
        </p>

        <p>
          <strong>Reported by:</strong>{" "}
          {report.reporter?.id ? (
            <Link href={`/profiles/${report.reporter.id}`}>{reporterName}</Link>
          ) : (
            reporterName
          )}
          <strong> on :</strong>{" "}
          {report.created_at
            ? new Date(report.created_at).toLocaleString()
            : "Unknown"}
        </p>

        {report.post?.id && (
          <p>
            <strong>Post:</strong>{" "}
            <Link href={`/posts/${report.post.id}`}>View reported post</Link>
          </p>
        )}

        {report.reviewed_at && (
          <p>
            <strong>Reviewed by:</strong> {reviewerName} on{" "}
            {new Date(report.reviewed_at).toLocaleString()}
          </p>
        )}
      </div>

      <footer className="report-card__actions">
        <button
          type="button"
          onClick={() => handleStatusChange("reviewed")}
          disabled={isPending || status === "reviewed"}
        >
          Mark reviewed
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange("dismissed")}
          disabled={isPending || status === "dismissed"}
        >
          Dismiss
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange("actioned")}
          disabled={isPending || status === "actioned"}
        >
          Mark actioned
        </button>

        {status !== "open" && (
          <button
            type="button"
            onClick={() => handleStatusChange("open")}
            disabled={isPending}
          >
            Reopen
          </button>
        )}
      </footer>

    </article>
  );
}
