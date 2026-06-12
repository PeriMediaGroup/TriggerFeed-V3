"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const SUCCESS_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setStatus("Please enter your email address.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setStatus(
        "We could not send a reset link right now. Please try again later.",
      );
      setIsLoading(false);
      return;
    }

    setStatus(SUCCESS_MESSAGE);
    setIsLoading(false);
  }

  return (
    <main className="auth-forgot-password">
      <section
        className="auth-forgot-password__card"
        aria-labelledby="forgot-password-title"
      >
        <header className="auth-forgot-password__header">
          <p className="auth-forgot-password__eyebrow">Account help</p>
          <h1 id="forgot-password-title" className="auth-forgot-password__title">
            Reset your password
          </h1>
          <p className="auth-forgot-password__intro">
            Enter your account email and we will send a password reset link if
            the account exists.
          </p>
        </header>

        <form className="auth-forgot-password__form" onSubmit={handleSubmit}>
          <div className="auth-forgot-password__field">
            <label
              className="auth-forgot-password__label"
              htmlFor="forgot-password-email"
            >
              Email
            </label>
            <input
              id="forgot-password-email"
              className="auth-forgot-password__input"
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <button
            className="auth-forgot-password__submit"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {status ? (
          <p className="auth-forgot-password__status" role="status">
            {status}
          </p>
        ) : null}

        <footer className="auth-forgot-password__footer">
          <Link href="/login">Back to login</Link>
        </footer>
      </section>
    </main>
  );
}
