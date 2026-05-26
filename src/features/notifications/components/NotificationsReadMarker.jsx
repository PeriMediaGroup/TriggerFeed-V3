"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { markNotificationsRead } from "@/features/notifications/actions/markNotificationsRead";

export default function NotificationsReadMarker() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const result = await markNotificationsRead();

      if (!result?.success) {
        toast.error(result?.message || "Could not mark notifications as read.");
        return;
      }

      router.refresh();
    }

    run();
  }, [router]);

  return null;
}
