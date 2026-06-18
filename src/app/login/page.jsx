"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";
import { UserPlus } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      await logAuthEvent({
        email: cleanEmail,
        eventType: "login_failed",
        success: false,
        errorCode: error.code || null,
        errorMessage: error.message,
        metadata: {
          source: "login_page",
        },
      });

      setStatus(getUserSafeErrorMessage(error, "Could not log in."));
      setIsLoading(false);
      return;
    }

    const user = data.user;

    await logAuthEvent({
      userId: user?.id || null,
      email: cleanEmail,
      eventType: "login_success",
      success: true,
      metadata: {
        source: "login_page",
      },
    });

    const { data: profile, error: profileError } = await supabase
      .rpc("get_my_profile_auth_status")
      .single();

    if (profileError || !profile) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "login_profile_check_failed",
        success: false,
        errorCode: profileError?.code || null,
        errorMessage: profileError?.message || "Profile not found.",
        metadata: {
          source: "login_page",
        },
      });

      setStatus("You logged in, but we could not load your profile.");
      setIsLoading(false);
      return;
    }

    if (profile.is_deleted) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "login_blocked_deleted",
        success: false,
        metadata: {
          source: "login_page",
        },
      });

      await supabase.auth.signOut();
      setStatus("This account is no longer active.");
      setIsLoading(false);
      return;
    }

    if (profile.is_banned) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "login_blocked_banned",
        success: false,
        metadata: {
          source: "login_page",
        },
      });

      await supabase.auth.signOut();
      setStatus("This account is not available.");
      setIsLoading(false);
      return;
    }

    if (!profile.username || !profile.dob || !profile.age_verified_at) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="auth-login">
      <section className="auth-login__card" aria-labelledby="login-title">
        <header className="auth-login__header">
          <p className="auth-login__eyebrow">Welcome back</p>
          <h1 id="login-title" className="auth-login__title">
            Log in to TriggerFeed
          </h1>
          <p className="auth-login__intro">
            Get back to your feed, profile, friends, and notifications.
          </p>
        </header>

        <form className="auth-login__form" onSubmit={handleLogin}>
          <div className="auth-login__field">
            <label className="auth-login__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="auth-login__input"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="auth-login__field">
            <label className="auth-login__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="auth-login__input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <Link className="auth-login__forgot-link" href="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button
            className="auth-login__submit"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="auth-login__footer">
          <span>Need an account?</span>
          <Link className="auth-login__signup-link" href="/signup">
            <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
            <span>Sign up</span>
          </Link>
        </div>

        {status ? (
          <p className="auth-login__status" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}
