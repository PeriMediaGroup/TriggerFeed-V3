"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function getReportHref(pathname) {
  const safePath = pathname && pathname.startsWith("/") ? pathname : "/";
  const params = new URLSearchParams({
    topic: "broken-link",
    path: safePath,
  });

  return `/contact?${params.toString()}`;
}

export default function NotFoundPage() {
  const pathname = usePathname();
  const reportHref = getReportHref(pathname);

  return (
    <main className="tf-page__content public-page">
      <section className="public-page-hero" aria-labelledby="not-found-title">
        <div className="public-page-hero__content">
          <p className="public-page-hero__eyebrow">404</p>
          <h1 className="public-page-hero__title" id="not-found-title">
            Page not found
          </h1>
          <p className="public-page-hero__body">
            The page you&apos;re looking for may have been moved, deleted, or
            never existed.
          </p>
          <div className="public-page-hero__actions">
            <Link className="public-page-hero__action" href="/">
              Back to TriggerFeed
            </Link>
            <Link
              className="public-page-hero__action public-page-hero__action--secondary"
              href={reportHref}
            >
              Report a problem
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
