"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";

import { reportPost } from "../actions/reportPost";

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "threats", label: "Threats" },
  { value: "illegal_content", label: "Illegal content" },
  { value: "graphic_content", label: "Graphic content" },
  { value: "scam", label: "Scam" },
  { value: "other", label: "Other" },
];

export default function ReportPostButton({
  postId,
  viewerHasReported = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

    startTransition(async () => {
      const result = await reportPost({
        postId,
        reason,
        details,
      });

      setMessage(result.message);

      if (result.ok) {
        setIsOpen(false);
      }
    });
  }

  if (viewerHasReported) {
    return (
      <button
        type="button"
        className="post-report-button post-report-button--reported"
        disabled
        title="You already reported this post"
      >
        <Flag size={16} aria-hidden="true" />
        <span>Reported</span>
      </button>
    );
  }

  return (
    <div className="post-report">
      <button
        type="button"
        className="post-report-button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <Flag size={16} aria-hidden="true" />
        <span>Report</span>
      </button>

      {isOpen && (
        <form className="post-report__form" onSubmit={handleSubmit}>
          <label className="post-report__field">
            <span className="post-report__label">Reason</span>

            <select
              className="post-report__select"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isPending}
            >
              {REPORT_REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="post-report__field">
            <span className="post-report__label">Details</span>

            <textarea
              className="post-report__textarea"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              placeholder="Optional details"
              disabled={isPending}
            />
          </label>

          <div className="post-report__actions">
            <button type="submit" disabled={isPending}>
              {isPending ? "Reporting..." : "Submit report"}
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && <p className="post-report__message">{message}</p>}
    </div>
  );
}