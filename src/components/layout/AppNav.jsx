import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getProfileById } from "@/features/profiles/data/getProfileById";

export default async function AppNav() {
  const user = await getCurrentUser();

  let profile = null;

  if (user?.id) {
    const result = await getProfileById(user.id);
    profile = result.profile;
  }

  const username =
    profile?.username ||
    user?.user_metadata?.username ||
    user?.email ||
    null;

  return (
    <nav aria-label="Main navigation">
      <Link href="/">Home</Link>

      {user ? (
        <>
          {" | "}
          <Link href="/friends">Friends</Link>
          {" | "}
          <Link href="/posts/new">Create Post</Link>
          {" | "}
          <Link href={`/profile/`}>Profile</Link>
          {" | "}
          <span>
            Logged in as <strong>{username || "Unknown user"}</strong>
          </span>
          {" | "}
          <a href="/logout">Log out</a>
        </>
      ) : (
        <>
          {" | "}
          <Link href="/login">Login</Link>
        </>
      )}
    </nav>
  );
}