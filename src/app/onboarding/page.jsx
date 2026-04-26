"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { logAuthEvent } from "@/lib/authEvents";

export default function OnboardingPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("Loading your account...");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setStatus("Please log in to finish setting up your profile.");
        router.replace("/login");
        return;
      }

      setUser(data.user);
      setStatus("");
    }

    loadUser();
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setStatus("Please choose a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setStatus("Username must be at least 3 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setStatus("Username can only use letters, numbers, and underscores.");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
      })
      .eq("id", user.id);

    if (error) {
      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "onboarding_failed",
        success: false,
        errorCode: error.code || null,
        errorMessage: error.message,
        metadata: {
          source: "onboarding_page",
          username: cleanUsername,
        },
      });

      if (error.code === "23505") {
        setStatus("That username is already taken.");
      } else {
        setStatus("We could not save your username. Please try again.");
      }

      setIsLoading(false);
      return;
    }

    await logAuthEvent({
      userId: user.id,
      email: user.email,
      eventType: "onboarding_completed",
      success: true,
      metadata: {
        source: "onboarding_page",
      },
    });

    router.replace("/feed");
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      <h1>Finish setting up your profile</h1>
      <p>Choose a username so people can recognize you on TriggerFeed.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <label>
          Username
          <input
            type="text"
            value={username}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
            style={{ display: "block", width: "100%", padding: "0.75rem" }}
          />
        </label>

        <button type="submit" disabled={isLoading || !user}>
          {isLoading ? "Saving..." : "Save username"}
        </button>
      </form>

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </main>
  );
}