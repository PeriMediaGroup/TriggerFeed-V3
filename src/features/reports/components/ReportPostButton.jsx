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
  const reportFormId = `post-report-form-${postId}`;
  const reportTitleId = `post-report-title-${postId}`;
  const reportDescriptionId = `post-report-description-${postId}`;
  const reportReasonId = `post-report-reason-${postId}`;
  const reportDetailsId = `post-report-details-${postId}`;

  function closeForm() {
    if (!isPending) {
      setIsOpen(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      closeForm();
    }
  }

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
        aria-controls={isOpen ? reportFormId : undefined}
        aria-label={isIcon ? "Report post" : undefined}
        title={isIcon ? "Report post" : undefined}
      >
        <Flag size={16} strokeWidth={2} aria-hidden="true" />
        {!isIcon && <span>Report</span>}
      </button>

      {isOpen && (
        <form
          id={reportFormId}
          className="post-report__form"
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          aria-labelledby={reportTitleId}
          aria-describedby={reportDescriptionId}
        >
          <header className="post-report__header">
            <h3 id={reportTitleId} className="post-report__title">
              Report post
            </h3>
            <p id={reportDescriptionId} className="post-report__description">
              Tell us what’s wrong with this post.
            </p>
          </header>

          <div className="post-report__field">
            <label className="post-report__label" htmlFor={reportReasonId}>
              Reason
            </label>

            <select
              id={reportReasonId}
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
          </div>

          <div className="post-report__field">
            <label className="post-report__label" htmlFor={reportDetailsId}>
              Details
            </label>

            <textarea
              id={reportDetailsId}
              className="post-report__textarea"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              placeholder="Add any extra details..."
              disabled={isPending}
            />
          </div>

          <div className="post-report__actions">
            <button
              className="post-report__submit"
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Reporting..." : "Submit report"}
            </button>

            <button
              className="post-report__cancel"
              type="button"
              onClick={closeForm}
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
