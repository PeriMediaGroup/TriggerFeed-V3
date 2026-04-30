// src/features/profiles/components/ProfileHeader.jsx

import Link from "next/link";
import Image from "next/image";

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

  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Unknown";

  return (
    <section className="profile-header">
      <div className="profile-header__banner">
        {profile?.banner_cloudinary_url && (
          <img
            src={profile.banner_cloudinary_url}
            alt=""
            className="profile-header__banner-image"
          />
        )}
      </div>

      <div className="profile-header__body">
        <div className="profile-header__avatar">
          {profile?.avatar_cloudinary_url ? (
            <img
              src={profile.avatar_cloudinary_url}
              alt={`${displayName} avatar`}
              className="profile-header__avatar-image"
            />
          ) : (
            <Image
              className="profile-header__avatar-image"
              src="https://res.cloudinary.com/triggerfeed/image/upload/v1759969320/profile-pics/1fc0aaa0-6994-426f-8bbc-8fc2cb5d94f7.png"
              alt="Default Avitar"
              width="150"
              height="150"
            />
          )}
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

          {location && <p className="profile-header__location">{location}</p>}

          <p className="profile-header__joined">Joined {joinedDate}</p>
        </div>

        {isCurrentUser && (
          <div>
            <Link href="/profile/edit" className="profile-header__edit">
              Edit Profile
            </Link>
            <br/>
            <Link href="/profile/friends" className="profile__action-link">
              Find Friends
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
