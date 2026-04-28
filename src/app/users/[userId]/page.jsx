import Link from "next/link";
import Image from "next/image";
import { getProfileById } from "@/features/profiles/data/getProfileById";

export default async function UserProfilePage({ params }) {
  const { userId } = await params;

  const { profile, error } = await getProfileById(userId);

  if (error || !profile) {
    return (
      <main className="user-profile-page">
        <Link href="/posts">← Back to posts</Link>

        <h1>Profile not found</h1>
        {error && <p>{error}</p>}
      </main>
    );
  }

  const displayName =
    profile.username ||
    profile.first_name ||
    "Unknown user";

  const joinedDate = profile.joined_at || profile.created_at;

  return (
    <main className="user-profile-page">
      <Link href="/">← Back to Feed</Link>

      <section className="user-profile">
        <header className="user-profile__header">
          {profile.profile_image_url ? (
            <Image
              className="user-profile__avatar"
              src={profile.profile_image_url}
              alt=""
              width={80}
              height={80}
            />
          ) : (
            <div className="user-profile__avatar user-profile__avatar--fallback">
              No image at this time, default coming soon
            </div>
          )}

          <div>
            <h1>{displayName}</h1>

            {profile.first_name && (
              <p>
                {profile.first_name}
                {profile.last_name ? ` ${profile.last_name}` : ""}
              </p>
            )}

            {(profile.city || profile.state) && (
              <p>
                {[profile.city, profile.state].filter(Boolean).join(", ")}
              </p>
            )}

            {joinedDate && (
              <p>
                Joined{" "}
                <time dateTime={joinedDate}>
                  {new Date(joinedDate).toLocaleDateString()}
                </time>
              </p>
            )}
          </div>
        </header>

        {profile.about && (
          <section className="user-profile__about">
            <h2>About</h2>
            <p>{profile.about}</p>
          </section>
        )}
      </section>
    </main>
  );
}