import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getProfileById } from "@/features/profiles/data/getProfileById";
import { LogIn, PlusCircle, UserPlus } from "lucide-react";

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
    <nav aria-label="Main navigation" className="app-nav">
      {user ? (
        <span className="app-nav__link app-nav__link-create">
          <Link href="/posts/new">
            <PlusCircle size={18} strokeWidth={2} aria-hidden="true" />CREATE
          </Link>
        </span>
      ) : (
        <>
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
