"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import toast from "react-hot-toast";

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
  variant = "default",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();
  const isIcon = variant === "icon";

  function handleSubmit(event) {
    event.preventDefault();

    startTransition(async () => {
      const result = await reportPost({
        postId,
        reason,
        details,
      });

      if (result.ok) {
        toast.success(result.message || "Post reported.");
        setIsOpen(false);
        return;
      }

      toast.error(result.message || "Could not report this post.");
    });
  }

  if (viewerHasReported) {
    return (
      <button
        type="button"
        className={
          isIcon
            ? "post-card__icon-action post-report-button post-report-button--reported"
            : "post-report-button post-report-button--reported"
        }
        disabled
        title="You already reported this post"
        aria-label={isIcon ? "Post already reported" : undefined}
      >
        <Flag size={16} strokeWidth={2} aria-hidden="true" />
        {!isIcon && <span>Reported</span>}
      </button>
    );
  }

  return (
    <div className="post-report">
      <button
        type="button"
        className={
          isIcon
            ? "post-card__icon-action post-report-button"
            : "post-report-button"
        }
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={isIcon ? "Report post" : undefined}
        title={isIcon ? "Report post" : undefined}
      >
        <Flag size={16} strokeWidth={2} aria-hidden="true" />
        {!isIcon && <span>Report</span>}
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
    </div>
  );
}