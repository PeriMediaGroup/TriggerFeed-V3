// src/features/profiles/components/EditProfileForm.jsx

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, Check, Loader2 } from "lucide-react";

import { updateProfile } from "@/features/profiles/actions/updateProfile";
import {
  DEFAULT_PROFILE_AVATAR_URL,
  DEFAULT_PROFILE_BANNER_LABEL,
} from "@/features/profiles/constants/profileImages";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

function isBlobUrl(url) {
  return typeof url === "string" && url.startsWith("blob:");
}

export default function EditProfileForm({ profile }) {
  const formRef = useRef(null);
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");
  const [errors, setErrors] = useState({});

  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(
    profile?.avatar_cloudinary_url || "",
  );

  const [bannerPreviewUrl, setBannerPreviewUrl] = useState(
    profile?.banner_cloudinary_url || "",
  );

  useEffect(() => {
    return () => {
      if (isBlobUrl(avatarPreviewUrl)) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }

      if (isBlobUrl(bannerPreviewUrl)) {
        URL.revokeObjectURL(bannerPreviewUrl);
      }
    };
  }, [avatarPreviewUrl, bannerPreviewUrl]);

  function saveProfile() {
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);

    setSaveMessage("Saving...");
    setErrors({});

    startTransition(async () => {
      const result = await updateProfile(initialState, formData);

      if (result?.success) {
        setSaveMessage(result.message || "Profile updated.");
        setErrors({});
        return;
      }

      setSaveMessage(result?.message || "Could not save profile.");
      setErrors(result?.errors || {});
    });
  }

  function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setAvatarPreviewUrl((currentUrl) => {
      if (isBlobUrl(currentUrl)) {
        URL.revokeObjectURL(currentUrl);
      }

      return URL.createObjectURL(file);
    });

    saveProfile();
  }

  function handleBannerChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setBannerPreviewUrl((currentUrl) => {
      if (isBlobUrl(currentUrl)) {
        URL.revokeObjectURL(currentUrl);
      }

      return URL.createObjectURL(file);
    });

    saveProfile();
  }

  function handleTextKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.currentTarget.tagName === "TEXTAREA") return;

    event.preventDefault();
    event.currentTarget.blur();
    saveProfile();
  }

  const statusClassName = `profile-edit-form__status ${
    isPending ? "is-saving" : "is-saved"
  }`;

  return (
    <form ref={formRef} className="profile-edit-form">
      <header className="profile-edit-form__header">
        {saveMessage && (
          <span className={statusClassName}>
            {isPending ? (
              <Loader2 size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Check size={15} strokeWidth={2} aria-hidden="true" />
            )}
            {saveMessage}
          </span>
        )}
      </header>

      <section className="profile-edit-form__media" aria-label="Profile media">
        <div className="profile-header__banner profile-edit-form__banner">
          {bannerPreviewUrl ? (
            <Image
              src={bannerPreviewUrl}
              alt=""
              fill
              sizes="100vw"
              className="profile-header__banner-image"
              unoptimized={isBlobUrl(bannerPreviewUrl)}
            />
          ) : (
            <div className="profile-header__banner-placeholder">
              {DEFAULT_PROFILE_BANNER_LABEL}
            </div>
          )}

          <label className="profile-edit-form__camera profile-edit-form__camera--banner">
            <Camera size={18} strokeWidth={2} aria-hidden="true" />

            <input
              type="file"
              name="banner"
              accept="image/*"
              hidden
              onChange={handleBannerChange}
            />
          </label>
        </div>

        <div className="profile-edit-form__avatar-wrap">
          <div className="profile-header__avatar">
            <Image
              src={avatarPreviewUrl || DEFAULT_PROFILE_AVATAR_URL}
              alt=""
              width={150}
              height={150}
              className="profile-header__avatar-image"
              unoptimized={isBlobUrl(avatarPreviewUrl)}
            />
          </div>

          <label className="profile-edit-form__camera profile-edit-form__camera--avatar">
            <Camera size={16} strokeWidth={2} aria-hidden="true" />

            <input
              type="file"
              name="avatar"
              accept="image/*"
              hidden
              onChange={handleAvatarChange}
            />
          </label>
        </div>
      </section>

      <section className="profile-edit-form__section">
        <h2 className="profile-edit-form__section-title">Profile Info</h2>

        <div className="profile-edit-form__field">
          <label htmlFor="display_name">Display Name</label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={profile?.display_name || ""}
            placeholder="Jon Doe"
            onBlur={saveProfile}
            onKeyDown={handleTextKeyDown}
          />
        </div>

        <div className="profile-edit-form__field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue={profile?.username || ""}
            placeholder="Username"
            required
            onBlur={saveProfile}
            onKeyDown={handleTextKeyDown}
          />

          {errors?.username && (
            <p className="profile-edit-form__error">{errors.username}</p>
          )}
        </div>

        <div className="profile-edit-form__row">
          <div className="profile-edit-form__field">
            <label htmlFor="first_name">First Name</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              defaultValue={profile?.first_name || ""}
              onBlur={saveProfile}
              onKeyDown={handleTextKeyDown}
            />
          </div>

          <div className="profile-edit-form__field">
            <label htmlFor="last_name">Last Name</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              defaultValue={profile?.last_name || ""}
              onBlur={saveProfile}
              onKeyDown={handleTextKeyDown}
            />
          </div>
        </div>

        <div className="profile-edit-form__field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={profile?.email || ""}
            placeholder="you@example.com"
            onBlur={saveProfile}
            onKeyDown={handleTextKeyDown}
          />

          <p className="profile-edit-form__hint">
            Email is private by default and only appears publicly if you enable
            it in privacy settings.
          </p>

          {errors?.email && (
            <p className="profile-edit-form__error">{errors.email}</p>
          )}
        </div>
      </section>

      <section className="profile-edit-form__section">
        <h2 className="profile-edit-form__section-title">Location</h2>

        <div className="profile-edit-form__row">
          <div className="profile-edit-form__field">
            <label htmlFor="city">City</label>
            <input
              id="city"
              name="city"
              type="text"
              defaultValue={profile?.city || ""}
              onBlur={saveProfile}
              onKeyDown={handleTextKeyDown}
            />
          </div>

          <div className="profile-edit-form__field">
            <label htmlFor="state">State</label>

            <select
              id="state"
              name="state"
              defaultValue={profile?.state || ""}
              onChange={saveProfile}
            >
              <option value="">Select state</option>

              {US_STATES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="profile-edit-form__section">
        <h2 className="profile-edit-form__section-title">Field Notes</h2>

        <div className="profile-edit-form__field">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={profile?.bio || ""}
            rows={5}
            maxLength={500}
            placeholder="Tell people a little about yourself."
            onBlur={saveProfile}
          />

          {errors?.bio && (
            <p className="profile-edit-form__error">{errors.bio}</p>
          )}
        </div>
      </section>

      <div className="profile-edit-form__actions">
        <Link href="/profile" className="profile-edit-form__done">
          Done
        </Link>
      </div>
    </form>
  );
}
