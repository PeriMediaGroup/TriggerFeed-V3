// src/features/profiles/components/ProfileHeader.jsx

import Link from "next/link";
import Image from "next/image";
import { formatShortDate } from "@/lib/formatDate";
import { Pencil, CalendarDays, MapPin } from "lucide-react";

export default function ProfileHeader({
  profile,
  stats,
  isCurrentUser = false,
}) {
  const displayName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.username ||
    "Your Name";

  const username = profile?.username || "your_username";
  const email = profile?.email || "your_email";
  const bannerUrl = profile?.banner_cloudinary_url?.trim();
  const avatarUrl = profile?.avatar_cloudinary_url?.trim();

  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  return (
    <section className="profile-header">
      <div className="profile__banner">
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="profile__banner-image" />
        ) : (
          <div className="profile__banner-placeholder">TF</div>
        )}
      </div>

      <div className="profile-header__body">
        <div className="profile-header__avatar-wrap">
          <div className="profile__avatar">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${displayName} avatar`}
                className="profile__avatar-image"
              />
            ) : (
              <Image
                className="profile__avatar-image"
                src="https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png"
                alt="Default Avatar"
                width="150"
                height="150"
              />
            )}
          </div>
        </div>

        <div className="profile-header__identity">
          <h1 className="profile-header__name">{displayName}</h1>
          <p className="profile-header__username">@{username}</p>
          <p>{email}</p>

          {(profile?.profile_badge || profile?.role) && (
            <p className="profile-header__badge">
              {profile.profile_badge || profile.role}
            </p>
          )}

          {location && (
            <p className="profile-header__location">
              <MapPin size={15} strokeWidth={2} aria-hidden="true" />
              {location}
            </p>
          )}

          <p className="profile-header__joined">
            <CalendarDays size={15} strokeWidth={2} aria-hidden="true" /> Joined{" "}
            {formatShortDate(profile?.created_at)}
          </p>
        </div>

        {isCurrentUser && (
          <div>
            <Link href="/profile/edit" className="profile-header__edit">
              <Pencil size={16} strokeWidth={2} aria-hidden="true" />
              Edit Profile
            </Link>

            <br />

            <Link href="/profile/friends" className="profile__action-link">
              Manage Friends
            </Link>

            <br />

            <Link href="/profile/guns" className="profile__action-link">
              Edit Top Guns
            </Link>
          </div>
        )}
      </div>

      <div className="profile-header__stats">
        <div>
          <strong>{stats?.posts || 0}</strong>
          <span>Posts</span>
        </div>

        <div>
          <strong>{stats?.friends || 0}</strong>
          <span>Friends</span>
        </div>
      </div>
    </section>
  );
}