import Link from "next/link";

export default function OnboardingCompletePage() {
  return (
    <main className="onboarding-complete">
      <h1>Profile started</h1>

      <p>
        Your username is set. You can start using TriggerFeed now, or finish
        setting up your full profile.
      </p>

      <div className="onboarding-complete__actions">
        <Link href="/">Go to Feed</Link>
        <br/><br/>
        <Link href="/profile/edit">Edit Full Profile</Link>
      </div>
    </main>
  );
}