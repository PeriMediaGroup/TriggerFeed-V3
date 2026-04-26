"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { logAuthEvent } from "@/lib/authEvents";

export default function LoginPage() {
  const router = useRouter();

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

      setStatus(error.message || "Login failed.");
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
      .from("profiles")
      .select("id, username, is_banned, is_deleted")
      .eq("id", user.id)
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

    if (!profile.username) {
      router.replace("/onboarding");
      return;
    }

    router.replace("/feed");
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      <h1>Log in to TriggerFeed</h1>
      <p>Stage One login test. Not pretty, but it knows its job.</p>

      <form onSubmit={handleLogin} style={{ display: "grid", gap: "1rem" }}>
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
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            style={{ display: "block", width: "100%", padding: "0.75rem" }}
          />
        </label>

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Log in"}
        </button>
      </form>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </main>
  );
}