"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { dismissNotification } from "@/features/notifications/actions/dismissNotifications";

export default function DismissNotificationButton({ notificationId }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissNotification(notificationId);

      if (!result?.success) {
        toast.error(result?.message || "Could not dismiss notification.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="profile-notifications-page__dismiss"
      onClick={handleDismiss}
      disabled={isPending}
      aria-label="Dismiss notification"
      title="Dismiss notification"
    >
      <Trash2 size={16} aria-hidden="true" />
    </button>
  );
}
