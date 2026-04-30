import Link from "next/link";

export default async function CheckEmailPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const email = resolvedSearchParams?.email || "";

  return (
    <main className="auth-check-email">
      <h1>Check your email</h1>

      {email ? (
        <p>
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
      ) : (
        <p>We sent a confirmation link to your email address.</p>
      )}

      <p>
        Click the link in that email to finish creating your TriggerFeed account.
        After your account is confirmed, you’ll be able to choose your username
        and finish your profile.
      </p>

      <p>
        If you don’t see the email, check your spam or junk folder.
      </p>

      <div className="auth-check-email__actions">
        <Link href="/login">Go to Login</Link>
        <br/><br/>
        <Link href="/signup">Use a different email</Link>
      </div>
    </main>
  );
}