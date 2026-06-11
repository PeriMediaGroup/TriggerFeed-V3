"use client";

import { useState } from "react";

function getSupabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export default function ContactPage() {
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      website: String(formData.get("website") || "").trim(),
    };

    if (payload.website) {
      setStatus({ type: "success", message: "Message sent." });
      form.reset();
      return;
    }

    if (!payload.name || !payload.email || !payload.message) {
      setStatus({
        type: "error",
        message: "Please fill out name, email, and message.",
      });
      return;
    }

    const supabaseConfig = getSupabasePublicConfig();

    if (!supabaseConfig.url || !supabaseConfig.key) {
      setStatus({
        type: "error",
        message: "Contact is not configured yet. Email support@triggerfeed.com.",
      });
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(`${supabaseConfig.url}/functions/v1/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseConfig.key,
          Authorization: `Bearer ${supabaseConfig.key}`,
        },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          message: payload.message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      form.reset();
      setStatus({
        type: "success",
        message: "Message sent. We will reply if a reply is needed.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: `Could not send message. ${
          error?.message || "Try again later."
        }`,
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="tf-page__content contact-page">
      <header className="contact-page__header">
        <p className="contact-page__eyebrow">Support</p>
        <h1>Contact Us</h1>
        <p>
          Have a question, found a bug, or need help with your account? Send it
          here.
        </p>
      </header>

      <section className="contact-page__panel tf-page__content--ghost">
        <form className="contact-form" onSubmit={handleSubmit}>
          <label className="contact-form__field">
            <span>Name</span>
            <input type="text" name="name" autoComplete="name" required />
          </label>

          <label className="contact-form__field">
            <span>Email</span>
            <input type="email" name="email" autoComplete="email" required />
          </label>

          <label className="contact-form__field contact-form__field--hidden">
            <span>Website</span>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
            />
          </label>

          <label className="contact-form__field">
            <span>Message</span>
            <textarea name="message" rows="6" required />
          </label>

          <button
            type="submit"
            className="contact-form__submit"
            disabled={isSending}
          >
            {isSending ? "Sending..." : "Send"}
          </button>

          {status.message && (
            <p
              className={`contact-form__status contact-form__status--${status.type}`}
            >
              {status.message}
            </p>
          )}
        </form>

        <div className="contact-page__alternate">
          <p>
            Email: <a href="mailto:support@triggerfeed.com">support@triggerfeed.com</a>
          </p>
          <p>
            Call/Text: <a href="tel:8643729954">864-372-9954</a>
          </p>
        </div>
      </section>
    </main>
  );
}
