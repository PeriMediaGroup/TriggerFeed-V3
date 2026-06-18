"use client";

import { useState } from "react";

export default function Abuse() {
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      email: String(formData.get("email") || "").trim(),
      link: String(formData.get("link") || "").trim(),
      offending_username: String(
        formData.get("offending_username") || "",
      ).trim(),
      details: String(formData.get("details") || "").trim(),
      website: String(formData.get("website") || "").trim(),
    };

    if (payload.website) {
      setStatus({ type: "success", message: "Report submitted. Thank you." });
      form.reset();
      return;
    }

    if (!payload.email || !payload.link || !payload.details) {
      setStatus({
        type: "error",
        message: "Please include your email, a link, and a description.",
      });
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/report-abuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      form.reset();
      setStatus({ type: "success", message: "Report submitted. Thank you." });
    } catch (error) {
      console.error("ABUSE REPORT ERROR:", error);
      setStatus({
        type: "error",
        message: "Could not submit report. Please try again later.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      id="abuse"
      className="legal-section legal-section--abuse tf-page__content--ghost"
    >
      <h2>Report Abuse</h2>

      <p>
        If you see content that violates our Terms or CSAE Policy, you can
        report it here.
      </p>

      <form className="abuse-form" onSubmit={handleSubmit}>
        <label className="abuse-form__field">
          <span>Your Email</span>
          <input type="email" name="email" autoComplete="email" required />
        </label>

        <label className="abuse-form__field">
          <span>
            Link to Content/Post{" "}
            <em className="abuse-form__required">(required)</em>
          </span>
          <input
            name="link"
            placeholder="https://triggerfeed.com/posts/123"
            autoComplete="off"
            type="url"
            required
          />
        </label>

        <label className="abuse-form__field">
          <span>Offending Username (if known)</span>
          <input
            type="text"
            name="offending_username"
            placeholder="@username"
            autoComplete="off"
          />
        </label>

        <label className="abuse-form__field abuse-form__field--hidden">
          <span>Website</span>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>

        <label className="abuse-form__field">
          <span>
            Description{" "}
            <em className="abuse-form__required">
              (what makes this concerning)
            </em>
          </span>
          <textarea name="details" rows="6" required />
        </label>

        <button type="submit" className="abuse-form__submit" disabled={isSending}>
          {isSending ? "Sending..." : "Submit Report"}
        </button>

        {status.message && (
          <p className={`abuse-form__status abuse-form__status--${status.type}`}>
            {status.message}
          </p>
        )}
      </form>

      <p className="legal-section__note">
        For immediate danger or CSAE content, contact your local authorities and
        NCMEC.
      </p>
    </section>
  );
}
