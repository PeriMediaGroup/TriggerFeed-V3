"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";
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
import {
  SIGNUP_PROFILE_TYPES,
  SPECIALIZED_PROFILE_TYPES,
} from "@/features/auth/signupProfileTypes";

const REFERRAL_STORAGE_KEY = "triggerfeed.signupReferralCode";

function normalizeReferralCode(value = "") {
  const code = `${value || ""}`.trim();
  return /^[A-Za-z0-9_-]{8,64}$/.test(code) ? code : "";
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
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const rawCodeFromUrl = url.searchParams.get("ref");
  return rawCodeFromUrl !== null
    ? normalizeReferralCode(rawCodeFromUrl)
    : getStoredReferralCode();
}

function subscribeToSignupMessagingStore() {
  return () => {};
}

function normalizeSocialLinks(value) {
  return value
    .split(/[,;]/)
    .map((link) => link.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function metadataForUser({
  displayName,
  bio,
  category,
  subtype,
  websiteUrl,
  primaryLinkUrl,
  primaryLinkLabel,
  socialLinks,
  location,
  publicContactEmail,
  publicContactPhone,
}) {
  return {
    display_name: displayName.trim().slice(0, 120),
    bio: bio.trim().slice(0, 500) || null,
    profile_metadata: {
      category: category.trim().slice(0, 80),
      subtype: subtype.trim().slice(0, 80) || null,
      website_url: websiteUrl.trim().slice(0, 500) || null,
      primary_link_url: primaryLinkUrl.trim().slice(0, 500) || null,
      primary_link_label: primaryLinkLabel.trim().slice(0, 80) || null,
      social_links: normalizeSocialLinks(socialLinks),
      public_location: location.trim().slice(0, 120) || null,
      public_contact_email:
        publicContactEmail.trim().toLowerCase().slice(0, 254) || null,
      public_contact_phone: publicContactPhone.trim().slice(0, 40) || null,
    },
  };
}

export default function SignupForm({ profileType = "member" }) {
  const supabase = createClient();
  const router = useRouter();
  const isSpecialized = SPECIALIZED_PROFILE_TYPES.includes(profileType);
  const profileConfig =
    SIGNUP_PROFILE_TYPES[profileType] || SIGNUP_PROFILE_TYPES.member;
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode] = useState(getInitialReferralCode);
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("");
  const [subtype, setSubtype] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [primaryLinkUrl, setPrimaryLinkUrl] = useState("");
  const [primaryLinkLabel, setPrimaryLinkLabel] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [location, setLocation] = useState("");
  const [publicContactEmail, setPublicContactEmail] = useState("");
  const [publicContactPhone, setPublicContactPhone] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const signupMessaging = useSyncExternalStore(
    subscribeToSignupMessagingStore,
    getInitialSignupMessaging,
    () => DEFAULT_SIGNUP_MESSAGING,
  );

  useEffect(() => {
    if (referralCode) setStoredReferralCode(referralCode);
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
    if (isSpecialized && (!displayName.trim() || !category)) {
      setStatus("Please provide the required profile details.");
      return;
    }

    setIsLoading(true);
    const attribution = readStoredAttribution();
    const eventSource = isSpecialized
      ? `${profileType}_signup_page`
      : "signup_page";
    const eventMetadata = {
      source: eventSource,
      profile_type: profileType,
      age_gate_version: AGE_GATE_VERSION,
      has_referral_code: Boolean(referralCode),
      has_marketing_attribution: Boolean(attribution?.visitorId),
    };
    await logAuthEvent({
      email: cleanEmail,
      eventType: "signup_started",
      success: true,
      metadata: eventMetadata,
    });

    const userMetadata = {
      dob: cleanDob,
      age_gate_version: AGE_GATE_VERSION,
      birthday_messages_enabled: true,
    };
    if (isSpecialized) {
      Object.assign(
        userMetadata,
        metadataForUser({
          displayName,
          bio,
          category,
          subtype,
          websiteUrl,
          primaryLinkUrl,
          primaryLinkLabel,
          socialLinks,
          location,
          publicContactEmail,
          publicContactPhone,
        }),
        { profile_type: profileType },
      );
    }
    if (referralCode) userMetadata.referral_code = referralCode;
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
        metadata: eventMetadata,
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
        ...eventMetadata,
        needs_email_confirmation: !data.session,
        auth_user_id: data.user?.id || null,
      },
    });

    if (data.session && data.user?.id && attribution?.visitorId) {
      const { error: attributionError } = await supabase.rpc(
        "associate_my_marketing_attribution",
        { p_visitor_id: attribution.visitorId },
      );
      if (attributionError) {
        console.warn(
          "MARKETING ATTRIBUTION SIGNUP ASSOCIATION WARNING:",
          { code: attributionError.code, message: attributionError.message },
        );
      }
    }
    clearStoredReferralCode();
    clearStoredAttribution();
    router.push(`/signup/check-email?email=${encodeURIComponent(cleanEmail)}`);
  }

  const title = isSpecialized ? profileConfig.title : signupMessaging.title;
  const intro = isSpecialized ? profileConfig.intro : signupMessaging.intro;
  const eyebrow = isSpecialized ? profileConfig.eyebrow : signupMessaging.eyebrow;
  const input = (value, setter, props = {}) => (
    <input
      className="signup-form__input"
      value={value}
      onChange={(event) => setter(event.target.value)}
      {...props}
    />
  );

  return (
    <main className="signup-page">
      <section className="signup-form" aria-labelledby="signup-title">
        <div className="signup-form__header">
          <p className="signup-form__eyebrow">{eyebrow}</p>
          <h1 id="signup-title" className="signup-form__title">{title}</h1>
          <p className="signup-form__intro">{intro}</p>
        </div>
        <form className="signup-form__form" onSubmit={handleSignup}>
          {isSpecialized ? (
            <label className="signup-form__field">
              <span className="signup-form__label">{profileConfig.displayNameLabel}</span>
              {input(displayName, setDisplayName, { type: "text", maxLength: 120, required: true })}
            </label>
          ) : null}
          <label className="signup-form__field">
            <span className="signup-form__label">Email</span>
            {input(email, setEmail, { type: "email", autoComplete: "email", name: "email", required: true })}
          </label>
          <label className="signup-form__field">
            <span className="signup-form__label">Date of birth</span>
            {input(dob, setDob, { type: "date", name: "dob", autoComplete: "bday", required: true })}
            <span className="signup-form__hint">You must be 18 or older. Your DOB stays private unless you choose to show your age later.</span>
          </label>
          {isSpecialized ? (
            <>
              <label className="signup-form__field">
                <span className="signup-form__label">{profileConfig.categoryLabel}</span>
                <select className="signup-form__input" value={category} required onChange={(event) => setCategory(event.target.value)}>
                  <option value="">{profileConfig.categoryPlaceholder}</option>
                  {profileConfig.categories.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">{profileConfig.subtypeLabel}</span>
                {input(subtype, setSubtype, { type: "text", maxLength: 80, placeholder: profileConfig.subtypePlaceholder })}
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">{profileConfig.bioLabel}</span>
                <textarea className="signup-form__input" value={bio} maxLength={500} rows={4} onChange={(event) => setBio(event.target.value)} />
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">Website (optional)</span>
                {input(websiteUrl, setWebsiteUrl, { type: "url", maxLength: 500 })}
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">Primary external link (optional)</span>
                {input(primaryLinkUrl, setPrimaryLinkUrl, { type: "url", maxLength: 500 })}
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">Primary link label (optional)</span>
                {input(primaryLinkLabel, setPrimaryLinkLabel, { type: "text", maxLength: 80 })}
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">Social or channel links (optional)</span>
                <textarea className="signup-form__input" value={socialLinks} rows={3} placeholder="Separate links with commas or semicolons" onChange={(event) => setSocialLinks(event.target.value)} />
              </label>
              <label className="signup-form__field">
                <span className="signup-form__label">{profileConfig.locationLabel}</span>
                {input(location, setLocation, { type: "text", maxLength: 120 })}
              </label>
              {profileType === "organization" ? (
                <>
                  <label className="signup-form__field">
                    <span className="signup-form__label">Public contact email (optional)</span>
                    {input(publicContactEmail, setPublicContactEmail, { type: "email", maxLength: 254 })}
                  </label>
                  <label className="signup-form__field">
                    <span className="signup-form__label">Public phone (optional)</span>
                    {input(publicContactPhone, setPublicContactPhone, { type: "tel", maxLength: 40 })}
                  </label>
                </>
              ) : null}
            </>
          ) : null}
          <label className="signup-form__field">
            <span className="signup-form__label">Password</span>
            {input(password, setPassword, { type: "password", autoComplete: "new-password", name: "password", required: true })}
          </label>
          <label className="signup-form__field">
            <span className="signup-form__label">Confirm password</span>
            {input(confirmPassword, setConfirmPassword, { type: "password", autoComplete: "new-password", name: "confirmPassword", required: true })}
          </label>
          <label className="signup-form__terms">
            <input className="signup-form__checkbox" type="checkbox" checked={acceptedTerms} required onChange={(event) => setAcceptedTerms(event.target.checked)} />
            <span>I agree to TriggerFeed&apos;s <a className="signup-form__link" href="https://www.triggerfeed.com/legal" target="_blank" rel="noopener noreferrer">legal terms and policies</a>.</span>
          </label>
          <button className="signup-form__submit" type="submit" disabled={isLoading}>{isLoading ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="signup__signin">Already have an account? <Link href="/login">Sign in here</Link></p>
        {!isSpecialized ? (
          <p className="signup-form__alternate">Are you a Creator or Organization? <Link href="/signup/creator">Creator signup</Link> or <Link href="/signup/organization">Organization signup</Link></p>
        ) : null}
        {status ? <p className="signup-form__status" role="status">{status}</p> : null}
      </section>
    </main>
  );
}
