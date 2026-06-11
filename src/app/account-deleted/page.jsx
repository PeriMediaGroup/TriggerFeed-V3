import Link from "next/link";

export default function AccountDeletedPage() {
  return (
    <main className="tf-page__content account-delete-page">
      <section className="account-delete-page__panel tf-page__content--ghost">
        <p className="account-delete-page__eyebrow">Account deleted</p>
        <h1>Your Account Has Been Deleted</h1>

        <p>
          Your public profile details have been removed and you have been signed
          out.
        </p>

        <p>
          If you need help with anything else, contact TriggerFeed support.
        </p>

        <div className="account-delete-page__links">
          <Link href="/contact">Contact Support</Link>
          <Link href="/">Return Home</Link>
        </div>
      </section>
    </main>
  );
}
