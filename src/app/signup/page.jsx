"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AGE_GATE_VERSION,
  isAtLeastMinimumAge,
  isValidDobString,
} from "@/features/auth/ageGate";
import {
  clearStoredAttribution,
  readStoredAttribution,
} from "@/features/marketing/attribution";
import {
  DEFAULT_SIGNUP_MESSAGING,
  getInitialSignupMessaging,
} from "@/features/marketing/signupMessaging";

const REFERRAL_STORAGE_KEY = "triggerfeed.signupReferralCode";

function normalizeReferralCode(value = "") {
  const code = `${value || ""}`.trim();

  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) {
    return "";
  }

  return code;
}

function getStoredReferralCode() {
  try {
    return normalizeReferralCode(
      window.localStorage.getItem(REFERRAL_STORAGE_KEY),
    );
  } catch {
    return "";
  }
}

function setStoredReferralCode(referralCode) {
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode);
  } catch {
    // Referral metadata is still carried on the signup request.
  }
}

function clearStoredReferralCode() {
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Nothing else to clear.
  }
}

function getInitialReferralCode() {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  const rawCodeFromUrl = url.searchParams.get("ref");
  const codeFromUrl = normalizeReferralCode(rawCodeFromUrl);

  if (rawCodeFromUrl !== null) {
    return codeFromUrl;
  }

  return getStoredReferralCode();
}

function subscribeToSignupMessagingStore() {
  return () => {};
}

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode] = useState(getInitialReferralCode);
  const signupMessaging = useSyncExternalStore(
    subscribeToSignupMessagingStore,
    getInitialSignupMessaging,
    () => DEFAULT_SIGNUP_MESSAGING,
  );
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!referralCode) {
      return;
    }

    setStoredReferralCode(referralCode);
  }, [referralCode]);

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
    const attribution = readStoredAttribution();

    await logAuthEvent({
      email: cleanEmail,
      eventType: "signup_started",
      success: true,
      metadata: {
        source: "signup_page",
        age_gate_version: AGE_GATE_VERSION,
        has_referral_code: Boolean(referralCode),
        has_marketing_attribution: Boolean(attribution?.visitorId),
      },
    });

    const userMetadata = {
      dob: cleanDob,
      age_gate_version: AGE_GATE_VERSION,
      birthday_messages_enabled: true,
    };

    if (referralCode) {
      userMetadata.referral_code = referralCode;
    }

    if (attribution?.visitorId) {
      userMetadata.marketing_visitor_id = attribution.visitorId;
      userMetadata.marketing_source = attribution.source || null;
      userMetadata.marketing_campaign = attribution.campaign || null;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: userMetadata,
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
          has_referral_code: Boolean(referralCode),
          has_marketing_attribution: Boolean(attribution?.visitorId),
        },
      });

      setStatus(
        getUserSafeErrorMessage(error, "We could not create your account."),
      );
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
        has_referral_code: Boolean(referralCode),
        has_marketing_attribution: Boolean(attribution?.visitorId),
      },
    });

    if (data.session && data.user?.id && attribution?.visitorId) {
      const { error: attributionError } = await supabase.rpc(
        "associate_my_marketing_attribution",
        {
          p_visitor_id: attribution.visitorId,
        },
      );

      if (attributionError) {
        console.warn("MARKETING ATTRIBUTION SIGNUP ASSOCIATION WARNING:", {
          code: attributionError.code,
          message: attributionError.message,
        });
      }
    }

    clearStoredReferralCode();
    clearStoredAttribution();
    router.push(`/signup/check-email?email=${encodeURIComponent(cleanEmail)}`);
  }

  return (
    <main className="signup-page">
      <section className="signup-form" aria-labelledby="signup-title">
        <div className="signup-form__header">
          <p className="signup-form__eyebrow">{signupMessaging.eyebrow}</p>
          <h1 id="signup-title" className="signup-form__title">
            {signupMessaging.title}
          </h1>
          <p className="signup-form__intro">
            {signupMessaging.intro}
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

        <p className="signup__signin">
          Already have an account? <Link href="/login">Sign in here</Link>
        </p>

        {status ? (
          <p className="signup-form__status" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}
