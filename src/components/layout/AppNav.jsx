import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getProfileById } from "@/features/profiles/data/getProfileById";
import {
  Home,
  User,
  LogIn,
  LogOut,
  PlusCircle,
  UserPlus,
} from "lucide-react";

export default async function AppNav() {
  const user = await getCurrentUser();

  let profile = null;

  if (user?.id) {
    const result = await getProfileById(user.id);
    profile = result.profile;
  }

  const username =
    profile?.username || user?.user_metadata?.username || user?.email || null;

  return (
    <nav aria-label="Main navigation">
      <h1>TriggerFeed</h1>

      <Link href="/" className="app-nav__link">
        <Home size={18} strokeWidth={2} aria-hidden="true" />
        <span>Home</span>
      </Link>

      {user ? (
        <>
          {" | "}
          <Link href="/posts/new" className="app-nav__link">
            <PlusCircle size={18} strokeWidth={2} aria-hidden="true" />
            <span>Create</span>
          </Link>

          {" | "}
          <Link href="/profile" className="app-nav__link">
            <User size={18} strokeWidth={2} aria-hidden="true" />
            <span>Profile</span>
          </Link>

          {" | "}
          <span>
            Logged in as <strong>{username || "Unknown user"}</strong>
          </span>

          {" | "}
          <a href="/logout" className="app-nav__link">
            <LogOut size={17} strokeWidth={2} aria-hidden="true" />
            <span>Logout</span>
          </a>
        </>
      ) : (
        <>
          {" | "}
          <Link href="/login" className="app-nav__link">
            <LogIn size={18} strokeWidth={2} aria-hidden="true" />
            <span>Login</span>
          </Link>

          {" | "}
          <Link href="/signup" className="app-nav__link">
            <UserPlus size={18} strokeWidth={2} aria-hidden="true" />
            <span>Signup</span>
          </Link>
        </>
      )}
    </nav>
  );
}