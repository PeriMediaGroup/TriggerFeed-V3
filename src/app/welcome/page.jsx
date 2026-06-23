import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import AppLogo from "@/components/logo/AppLogo";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Welcome | TriggerFeed",
};

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="welcome-gate">
      <section className="welcome-gate__card" aria-labelledby="welcome-title">
        <div className="welcome-gate__brand">
          <AppLogo />
        </div>

        <div className="welcome-gate__copy">
          <p className="welcome-gate__eyebrow">Welcome to TriggerFeed</p>
          <h1 id="welcome-title">Join the conversation.</h1>
          <p>
            TriggerFeed is an 18+ community. Log in to access your feed, or
            create an account with age verification. Train. Carry. Stay ready.
          </p>
        </div>

        <div className="welcome-gate__actions">
          <Link className="welcome-gate__primary" href="/login">
            Log in
          </Link>
          <Link className="welcome-gate__secondary" href="/signup">
            Create Account
          </Link>
        </div>

        <nav className="welcome-gate__links" aria-label="Welcome resources">
          <Link href="/legal#terms">Terms</Link>
          <Link href="/legal#privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/legal#abuse">Report Abuse</Link>
        </nav>

        <p className="welcome-gate__disclaimer">
          This notice is not age verification. Date of birth is collected
          during account creation.
        </p>
      </section>
    </main>
  );
}
