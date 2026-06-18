"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";

import { updateAbuseReportStatus } from "@/features/reports/actions/updateAbuseReportStatus";

const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  action_taken: "Action taken",
};

const ACTIONS = [
  { status: "reviewing", label: "Mark reviewing", pending: "Updating..." },
  { status: "reviewed", label: "Mark reviewed", pending: "Updating..." },
  { status: "dismissed", label: "Dismiss", pending: "Dismissing..." },
  {
    status: "action_taken",
    label: "Mark action taken",
    pending: "Updating...",
  },
];

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

function getTextPreview(value, maxLength = 160) {
  const text = String(value || "").trim();

  if (!text) {
    return "No details provided.";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

export default function AbuseReportCard({ report }) {
  const [status, setStatus] = useState(report.status || "new");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(nextStatus) {
    setPendingStatus(nextStatus);

    startTransition(async () => {
      const result = await updateAbuseReportStatus({
        reportId: report.id,
        status: nextStatus,
      });

      setPendingStatus("");

      if (!result.ok) {
        toast.error(result.message || "Could not update abuse report.");
        return;
      }

      setStatus(nextStatus);
      toast.success(result.message || "Abuse report updated.");
    });
  }

  return (
    <article className={`report-card abuse-report-card abuse-report-card--${status}`}>
      <div className="report-card__summary">
        <header className="report-card__header">
          <span className="report-card__status">
            {STATUS_LABELS[status] || status}
          </span>
          <div className="report-card__heading">
            <p className="report-card__eyebrow">Abuse report</p>
            <h3 className="report-card__title">{report.link}</h3>
            <p className="report-card__preview">
              {getTextPreview(report.details)}
            </p>
          </div>
        </header>

        <div className="report-card__meta" aria-label="Abuse report summary">
          <span className="report-card__meta-item">Email: {report.email}</span>
          <span className="report-card__meta-item">
            Submitted: {formatDate(report.created_at)}
          </span>
          {report.offending_username ? (
            <span className="report-card__meta-item">
              Username: {report.offending_username}
            </span>
          ) : null}
          <span className="report-card__meta-item">Source: {report.source}</span>
          {report.reviewed_at ? (
            <span className="report-card__meta-item">
              Reviewed: {formatDate(report.reviewed_at)}
            </span>
          ) : null}
        </div>

        <div className="report-card__actions">
          {ACTIONS.map((action) => {
            const isActionPending = isPending && pendingStatus === action.status;

            return (
              <button
                key={action.status}
                type="button"
                className="report-card__action"
                onClick={() => handleStatusChange(action.status)}
                disabled={isPending || status === action.status}
              >
                {isActionPending ? action.pending : action.label}
              </button>
            );
          })}

          <button
            type="button"
            className="report-card__action report-card__toggle"
            onClick={() => setIsDetailsOpen((current) => !current)}
            aria-expanded={isDetailsOpen}
          >
            {isDetailsOpen ? "Hide Details" : "Details"}
          </button>
        </div>
      </div>

      {isDetailsOpen ? (
        <section className="report-card__details" aria-label="Abuse report details">
          <dl className="report-card__details-list">
            <div className="report-card__detail">
              <dt>Link</dt>
              <dd>
                <a href={report.link} target="_blank" rel="noopener noreferrer">
                  {report.link}
                </a>
              </dd>
            </div>

            <div className="report-card__detail">
              <dt>Email</dt>
              <dd>{report.email}</dd>
            </div>

            {report.offending_username ? (
              <div className="report-card__detail">
                <dt>Offending username</dt>
                <dd>{report.offending_username}</dd>
              </div>
            ) : null}

            <div className="report-card__detail">
              <dt>Details</dt>
              <dd>{report.details}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </article>
  );
}
