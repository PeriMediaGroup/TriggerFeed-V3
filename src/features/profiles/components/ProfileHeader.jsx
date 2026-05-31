// src/features/profiles/components/ProfileHeader.jsx

import Link from "next/link";
import Image from "next/image";
import { formatShortDate } from "@/lib/formatDate";
import { Pencil, CalendarDays, MapPin, Mail, IdCard } from "lucide-react";

import {
  DEFAULT_PROFILE_AVATAR_URL,
  DEFAULT_PROFILE_BANNER_LABEL,
} from "@/features/profiles/constants/profileImages";

export default function ProfileHeader({
  profile,
  stats,
  isCurrentUser = false,
}) {
  const profileVisibility = profile?.privacy_settings?.profile_visibility || {};

  const canShowRealName =
    isCurrentUser || Boolean(profileVisibility.show_real_name);

  const canShowEmail = isCurrentUser || Boolean(profileVisibility.show_email);
  const canShowCity = isCurrentUser || Boolean(profileVisibility.show_city);
  const canShowState = isCurrentUser || Boolean(profileVisibility.show_state);

  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.username ||
    "Your Name";

  const realName = canShowRealName
    ? [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
    : "";

  const email = canShowEmail ? profile?.email : "";
  const username = profile?.username || "your_username";

  const location = [
    canShowCity ? profile?.city : "",
    canShowState ? profile?.state : "",
  ]
    .filter(Boolean)
    .join(", ");

  const bannerUrl = profile?.banner_cloudinary_url?.trim();
  const avatarUrl =
    profile?.avatar_cloudinary_url?.trim() || DEFAULT_PROFILE_AVATAR_URL;
  const displayBadge = profile?.profile_badge || "";
  const joinedDate = formatShortDate(profile?.created_at);

  return (
    <section className="profile-header">
      <div className="profile-header__banner">
        {bannerUrl ? (
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="100vw"
            className="profile-header__banner-image"
            priority
          />
        ) : (
          <div className="profile-header__banner-placeholder">
            {DEFAULT_PROFILE_BANNER_LABEL}
          </div>
        )}
      </div>

      <div className="profile-header__content">
        <div className="profile-header__main">
          <div className="profile-header__avatar-wrap">
            <div className="profile-header__avatar">
              <Image
                src={avatarUrl}
                alt={`${displayName} avatar`}
                width={150}
                height={150}
                className="profile-header__avatar-image"
              />
            </div>
          </div>

          <div className="profile-header__details">
            <div className="profile-header__row profile-header__row--identity">
              <div className="profile-header__title-group">
                <h1 className="profile-header__display-name">{displayName}</h1>
                <span className="profile-header__username">@{username}</span>
              </div>

              {isCurrentUser && (
                <Link href="/profile/edit" className="profile-header__edit">
                  <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                  <span>Edit Profile</span>
                </Link>
              )}
            </div>

            <div className="profile-header__row">
              {realName ? (
                <span className="profile-header__meta-item">
                  <IdCard size={15} strokeWidth={2} aria-hidden="true" />
                  {realName}
                </span>
              ) : (
                <span className="profile-header__meta-item profile-header__meta-item--empty" />
              )}

              <span className="profile-header__meta-item profile-header__meta-item--right">
                <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
                Joined {joinedDate}
              </span>
            </div>

            <div className="profile-header__row">
              {location ? (
                <span className="profile-header__meta-item">
                  <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                  {location}
                </span>
              ) : (
                <span className="profile-header__meta-item profile-header__meta-item--empty" />
              )}

              {email && (
                <a href={`mailto:${email}`} className="profile-header__email">
                  <Mail size={15} strokeWidth={2} aria-hidden="true" />
                  {email}
                </a>
              )}
            </div>

            {displayBadge && (
              <span className="profile-header__badge">{displayBadge}</span>
            )}
          </div>
        </div>

        {profile?.bio && (
          <div className="profile-header__notes">
            <h2 className="profile-header__notes-title">Field Notes</h2>
            <p className="profile-header__notes-text">{profile.bio}</p>
          </div>
        )}

        <div className="profile-header__stats" aria-label="Profile stats">
          <div className="profile-header__stat">
            <strong className="profile-header__stat-value">
              {stats?.posts || 0}
            </strong>
            <span className="profile-header__stat-label">Posts</span>
          </div>

          <div className="profile-header__stat">
            <strong className="profile-header__stat-value">
              {stats?.friends || 0}
            </strong>
            <span className="profile-header__stat-label">Friends</span>
          </div>
        </div>
      </div>
    </section>
  );
}
