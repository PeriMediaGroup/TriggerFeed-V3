import Link from "next/link";

export default function AppLogo() {
  return (
    <Link href="/" className="app-logo" aria-label="TriggerFeed home">
      <span className="app-logo__mark"></span>
      <span className="app-logo__text">TriggerFeed</span>
    </Link>
  );
}