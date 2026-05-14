"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { dismissNotification } from "@/features/notifications/actions/dismissNotifications";

export default function NotificationTargetLink({
  notificationId,
  href,
  children,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(event) {
    event.preventDefault();

    startTransition(async () => {
      const result = await dismissNotification(notificationId);

      if (!result?.success) {
        console.error("DISMISS NOTIFICATION TARGET LINK ERROR:", result);
      }

      router.push(href);
      router.refresh();
    });
  }

  return (
    <a
      href={href}
      className="profile-notifications-page__target"
      onClick={handleClick}
      aria-disabled={isPending}
    >
      {children}
    </a>
  );
}