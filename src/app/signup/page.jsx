"use client";

import { useState } from "react";
import { createClient  } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password || !confirmPassword) {
      setStatus("Please fill out all required fields.");
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
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
      },
    });

    router.push(`/signup/check-email?email=${encodeURIComponent(cleanEmail)}`);
  }

  return (
    <main>
      <h1>Start your TriggerFeed account</h1>

      <form onSubmit={handleSignup}>
        <label>
          Email
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            style={{ display: "block", width: "100%", padding: "0.75rem" }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            style={{ display: "block", width: "100%", padding: "0.75rem" }}
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={{ display: "block", width: "100%", padding: "0.75rem" }}
          />
        </label>

        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          I agree to TriggerFeed&apos;s{" "}
          <a
            href="https://www.triggerfeed.com/legal"
            target="_blank"
            rel="noopener noreferrer"
          >
            legal terms and policies
          </a>
          .
        </label>

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </main>
  );
}
