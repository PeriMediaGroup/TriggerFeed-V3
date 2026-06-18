"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const RESET_LINK_INVALID_MESSAGE =
  "Your reset link has expired. Please request a new one.";
const RESET_LINK_CHECKING_MESSAGE = "Checking reset link...";
const RECOVERY_SESSION_WAIT_MS = 2500;
const RECOVERY_HASH_EVENT = "RECOVERY_HASH";
const RECOVERY_CODE_EVENT = "RECOVERY_CODE";
const RECOVERY_CALLBACK_EVENT = "RECOVERY_CALLBACK";
const RECOVERY_SUBMIT_EVENT = "RECOVERY_SUBMIT";
const PASSWORD_UNCHANGED_MESSAGE =
  "Please choose a new password that is different from your current password.";
const PASSWORD_UPDATE_SESSION_MESSAGE =
  "Your reset link has expired. Please request a new one.";
const PASSWORD_UPDATE_GENERIC_MESSAGE =
  "Could not update your password. Please try again.";

function debugRecoverySession(event, session) {
  console.info("[reset-password] auth", {
    event,
    hasSession: Boolean(session),
  });
}

function getPasswordUpdateErrorMessage(error) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    message.includes("different from the old password") ||
    message.includes("same password") ||
    message.includes("new password should be different") ||
    message.includes("new password must be different") ||
    message.includes("different from your current password")
  ) {
    return PASSWORD_UNCHANGED_MESSAGE;
  }

  if (
    message.includes("expired") ||
    message.includes("invalid") ||
    message.includes("session") ||
    message.includes("token") ||
    message.includes("jwt")
  ) {
    return PASSWORD_UPDATE_SESSION_MESSAGE;
  }

  return PASSWORD_UPDATE_GENERIC_MESSAGE;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const recoverySessionVerifiedRef = useRef(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(RESET_LINK_CHECKING_MESSAGE);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let recoverySessionResolved = false;
    let fallbackTimer = null;
    const code = searchParams.get("code");
    const isRecoveryCallback = searchParams.get("recovery") === "1";
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const hasRecoveryHash =
      hashParams.get("type") === "recovery" &&
      Boolean(accessToken) &&
      Boolean(refreshToken);
    const isRecoveryLink =
      Boolean(code) ||
      hasRecoveryHash ||
      isRecoveryCallback ||
      recoverySessionVerifiedRef.current;

    function finishSessionCheck(session, isRecoverySession = false) {
      if (!isMounted || recoverySessionResolved) {
        return;
      }

      recoverySessionResolved = true;

      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }

      if (session && isRecoverySession) {
        recoverySessionVerifiedRef.current = true;
      }

      setHasRecoverySession(Boolean(session) && isRecoverySession);
      setStatus(
        session && isRecoverySession ? "" : RESET_LINK_INVALID_MESSAGE,
      );
      setIsCheckingSession(false);
    }

    async function establishRecoverySession() {
      setIsCheckingSession(true);
      setStatus(RESET_LINK_CHECKING_MESSAGE);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        debugRecoverySession(RECOVERY_CODE_EVENT, session);

        if (error || !session) {
          finishSessionCheck(null);
          return;
        }

        finishSessionCheck(session, true);
        return;
      }

      if (hasRecoveryHash) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();

        debugRecoverySession(RECOVERY_HASH_EVENT, session);

        if (data.session && session) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          finishSessionCheck(session, true);
          return;
        }

        if (error || session) {
          finishSessionCheck(null);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        debugRecoverySession(RECOVERY_CALLBACK_EVENT, session);
        finishSessionCheck(session, isRecoveryLink);
        return;
      }

      if (!hasRecoveryHash) {
        finishSessionCheck(null);
        return;
      }

      fallbackTimer = setTimeout(() => {
        finishSessionCheck(null);
      }, RECOVERY_SESSION_WAIT_MS);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      debugRecoverySession(event, session);

      if (event === "PASSWORD_RECOVERY") {
        finishSessionCheck(session, true);
      }
    });

    establishRecoverySession();

    return () => {
      isMounted = false;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      subscription.unsubscribe();
    };
  }, [searchParams, supabase]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("");

    if (!hasRecoverySession) {
      setStatus(RESET_LINK_INVALID_MESSAGE);
      return;
    }

    if (!password || !confirmPassword) {
      setStatus("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    debugRecoverySession(RECOVERY_SUBMIT_EVENT, session);

    if (!session) {
      setStatus(RESET_LINK_INVALID_MESSAGE);
      setIsLoading(false);
      return;
    }

    const newPassword = password;
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setStatus(getPasswordUpdateErrorMessage(error));
      setIsLoading(false);
      return;
    }

    setStatus("Password updated. Redirecting to login...");

    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 900);
  }

  return (
    <section
      className="auth-reset-password__card"
      aria-labelledby="reset-password-title"
    >
      <header className="auth-reset-password__header">
        <p className="auth-reset-password__eyebrow">Account help</p>
        <h1 id="reset-password-title" className="auth-reset-password__title">
          Choose a new password
        </h1>
        <p className="auth-reset-password__intro">
          Enter a new password for your TriggerFeed account.
        </p>
      </header>

      {hasRecoverySession ? (
        <form className="auth-reset-password__form" onSubmit={handleSubmit}>
          <div className="auth-reset-password__field">
            <label
              className="auth-reset-password__label"
              htmlFor="reset-password"
            >
              New password
            </label>
            <input
              id="reset-password"
              className="auth-reset-password__input"
              type="password"
              value={password}
              autoComplete="new-password"
              required
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="auth-reset-password__field">
            <label
              className="auth-reset-password__label"
              htmlFor="reset-password-confirm"
            >
              Confirm password
            </label>
            <input
              id="reset-password-confirm"
              className="auth-reset-password__input"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              required
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <button
            className="auth-reset-password__submit"
            type="submit"
            disabled={isLoading || isCheckingSession}
          >
            {isLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      ) : null}

      {status ? (
        <p className="auth-reset-password__status" role="status">
          {status}
        </p>
      ) : null}

      {!hasRecoverySession && !isCheckingSession ? (
        <footer className="auth-reset-password__footer">
          <Link href="/forgot-password">Request a new reset link</Link>
        </footer>
      ) : null}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="auth-reset-password">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
