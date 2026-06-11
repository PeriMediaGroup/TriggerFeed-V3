"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { repairAgeGate } from "@/features/auth/actions/repairAgeGate";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [needsAgeRepair, setNeedsAgeRepair] = useState(false);
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
      const { data: profileStatus, error: profileStatusError } = await supabase
        .rpc("get_my_profile_auth_status")
        .maybeSingle();

      if (profileStatusError) {
        setStatus("We could not load your profile status. Please try again.");
        return;
      }

      setUsername(profileStatus?.username || "");
      setNeedsAgeRepair(
        !profileStatus?.dob || !profileStatus?.age_verified_at,
      );
      setStatus("");
    }

    loadUser();
  }, [router, supabase]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    if (!user) {
      setStatus("Please log in to finish setting up your profile.");
      router.replace("/login");
      return;
    }

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

    if (needsAgeRepair) {
      const ageGateFormData = new FormData();
      ageGateFormData.set("dob", dob);

      const ageGateResult = await repairAgeGate(ageGateFormData);

      if (!ageGateResult.success) {
        setStatus(ageGateResult.message || "We could not verify your age.");
        setIsLoading(false);
        return;
      }

      setNeedsAgeRepair(false);
    }

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
        console.error("ONBOARDING PROFILE UPDATE ERROR:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

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

    router.replace("/onboarding/complete");
  }

  return (
    <main className="auth-onboarding">
      <section className="auth-onboarding__card" aria-labelledby="onboarding-title">
        <header className="auth-onboarding__header">
          <p className="auth-onboarding__eyebrow">Profile setup</p>
          <h1 id="onboarding-title" className="auth-onboarding__title">
            Choose a username
          </h1>
          <p className="auth-onboarding__intro">
            Pick the handle people will recognize you by on TriggerFeed.
          </p>
        </header>

        <form className="auth-onboarding__form" onSubmit={handleSubmit}>
          {needsAgeRepair ? (
            <label className="auth-onboarding__field" htmlFor="dob">
              <span className="auth-onboarding__label">Date of birth</span>
              <input
                id="dob"
                className="auth-onboarding__input"
                type="date"
                value={dob}
                autoComplete="bday"
                required
                onChange={(event) => setDob(event.target.value)}
              />
              <span className="auth-onboarding__hint">
                You must be 18 or older. Your DOB stays private unless you
                choose to show your age later.
              </span>
            </label>
          ) : null}

          <label className="auth-onboarding__field" htmlFor="username">
            <span className="auth-onboarding__label">Username</span>
            <input
              id="username"
              className="auth-onboarding__input"
              type="text"
              value={username}
              autoComplete="username"
              minLength={3}
              pattern="[a-zA-Z0-9_]+"
              placeholder="User_Name"
              onChange={(event) => setUsername(event.target.value)}
            />
            <span className="auth-onboarding__hint">
              Use 3 or more letters, numbers, or underscores.
            </span>
          </label>

          <div className="auth-onboarding__actions">
            <button
              className="auth-onboarding__submit"
              type="submit"
              disabled={isLoading || !user}
            >
              {isLoading ? "Saving..." : "Save username"}
            </button>

            <Link className="auth-onboarding__secondary-link" href="/profile/edit">
              Edit full profile instead
            </Link>
          </div>
        </form>

        {status ? (
          <p className="auth-onboarding__status" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}
