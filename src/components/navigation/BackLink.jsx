"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const DEFAULT_BLOCKED_BACK_PATHS = [
  "/posts/new",
  "/edit",
  "/login",
  "/signup",
  "/logout",
];

function isBlockedBackPath(pathname, blockedPaths) {
  if (!pathname) return false;

  return blockedPaths.some((blockedPath) => pathname.includes(blockedPath));
}

export default function BackLink({
  label = "Back",
  href,
  fallbackHref = "/",
  mode = "smart",
  blockedBackPaths = DEFAULT_BLOCKED_BACK_PATHS,
  className = "back-link",
}) {
  const router = useRouter();

  const targetHref = href || fallbackHref;

  function handleBack() {
    if (mode === "link") {
      router.push(targetHref);
      return;
    }

    if (mode === "history") {
      if (window.history.length > 1) {
        router.back();
        return;
      }

      router.push(targetHref);
      return;
    }

    const previousPath = document.referrer
      ? new URL(document.referrer).pathname
      : "";

    const isSameOrigin =
      document.referrer && new URL(document.referrer).origin === window.location.origin;

    if (
      !isSameOrigin ||
      isBlockedBackPath(previousPath, blockedBackPaths) ||
      window.history.length <= 1
    ) {
      router.push(targetHref);
      return;
    }

    router.back();
  }

  if (mode === "link") {
    return (
      <Link href={targetHref} className={className}>
        <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}