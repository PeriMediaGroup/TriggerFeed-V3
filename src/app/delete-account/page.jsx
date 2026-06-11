import Link from "next/link";

export default function DeleteAccountPage() {
  return (
    <main className="tf-page__content account-delete-page">
      <section className="account-delete-page__panel tf-page__content--ghost">
        <p className="account-delete-page__eyebrow">Account deletion</p>
        <h1>Delete Your TriggerFeed Account</h1>

        <p>
          Logged-in users can delete their account from Profile, then Settings,
          then Danger Zone.
        </p>

        <p>
          If you cannot log in, contact{" "}
          <a href="mailto:support@triggerfeed.com">support@triggerfeed.com</a>{" "}
          and we will help verify the request.
        </p>

        <div className="account-delete-page__links">
          <Link href="/contact">Contact Support</Link>
          <Link href="/legal">Legal Information</Link>
        </div>
      </section>
    </main>
  );
}
