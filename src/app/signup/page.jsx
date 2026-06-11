"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { useRouter } from "next/navigation";
import {
  AGE_GATE_VERSION,
  isAtLeastMinimumAge,
  isValidDobString,
} from "@/features/auth/ageGate";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanDob = dob.trim();

    if (!cleanEmail || !cleanDob || !password || !confirmPassword) {
      setStatus("Please fill out all required fields.");
      return;
    }

    if (!isValidDobString(cleanDob)) {
      setStatus("Please enter a valid date of birth.");
      return;
    }

    if (!isAtLeastMinimumAge(cleanDob)) {
      setStatus("TriggerFeed is only available to users 18 or older.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    if (!acceptedTerms) {
      setStatus("You need to accept the terms before creating an account.");
      return;
    }

    setIsLoading(true);

    await logAuthEvent({
      email: cleanEmail,
      eventType: "signup_started",
      success: true,
      metadata: {
        source: "signup_page",
        age_gate_version: AGE_GATE_VERSION,
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          dob: cleanDob,
          age_gate_version: AGE_GATE_VERSION,
          birthday_messages_enabled: true,
        },
      },
    });

    if (error) {
      await logAuthEvent({
        email: cleanEmail,
        eventType: "signup_failed",
        success: false,
        errorCode: error.code || null,
        errorMessage: error.message,
        metadata: {
          source: "signup_page",
          age_gate_version: AGE_GATE_VERSION,
        },
      });

      setStatus(error.message || "We could not create your account.");
      setIsLoading(false);
      return;
    }

    await logAuthEvent({
      userId: data.session ? data.user?.id : null,
      email: cleanEmail,
      eventType: "signup_success",
      success: true,
      metadata: {
        source: "signup_page",
        needs_email_confirmation: !data.session,
        auth_user_id: data.user?.id || null,
        age_gate_version: AGE_GATE_VERSION,
      },
    });

    router.push(`/signup/check-email?email=${encodeURIComponent(cleanEmail)}`);
  }

  return (
    <main className="signup-page">
      <section className="signup-form" aria-labelledby="signup-title">
        <div className="signup-form__header">
          <p className="signup-form__eyebrow">18+ community</p>
          <h1 id="signup-title" className="signup-form__title">
            Start your TriggerFeed account
          </h1>
          <p className="signup-form__intro">
            Your date of birth is required for age verification and is hidden
            from your public profile by default.
          </p>
        </div>

        <form className="signup-form__form" onSubmit={handleSignup}>
          <label className="signup-form__field">
            <span className="signup-form__label">Email</span>
            <input
              className="signup-form__input"
              type="email"
              value={email}
              autoComplete="email"
              name="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="signup-form__field">
            <span className="signup-form__label">Date of birth</span>
            <input
              className="signup-form__input"
              type="date"
              name="dob"
              value={dob}
              autoComplete="bday"
              required
              onChange={(event) => setDob(event.target.value)}
            />
            <span className="signup-form__hint">
              You must be 18 or older. Your DOB stays private unless you choose
              to show your age later.
            </span>
          </label>

          <label className="signup-form__field">
            <span className="signup-form__label">Password</span>
            <input
              className="signup-form__input"
              type="password"
              name="password"
              value={password}
              autoComplete="new-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="signup-form__field">
            <span className="signup-form__label">Confirm password</span>
            <input
              className="signup-form__input"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              autoComplete="new-password"
              required
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          <label className="signup-form__terms">
            <input
              className="signup-form__checkbox"
              type="checkbox"
              checked={acceptedTerms}
              required
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              I agree to TriggerFeed&apos;s{" "}
              <a
                className="signup-form__link"
                href="https://www.triggerfeed.com/legal"
                target="_blank"
                rel="noopener noreferrer"
              >
                legal terms and policies
              </a>
              .
            </span>
          </label>

          <button
            className="signup-form__submit"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {status ? (
          <p className="signup-form__status" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}
