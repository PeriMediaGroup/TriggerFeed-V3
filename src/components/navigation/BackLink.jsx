"use client";

import { useRouter } from "next/navigation";

export default function BackLink({ label = "← Back", fallbackHref = "/posts" }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={handleBack} className="back-link">
      {label}
    </button>
  );
}