"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/features/notifications/actions/markNotificationsRead";

export default function NotificationsReadMarker() {
  const router = useRouter();

  useEffect(() => {
    async function run() {
      const result = await markNotificationsRead();

      if (!result?.success) {
        console.error("MARK NOTIFICATIONS READ CLIENT ERROR:", result);
        return;
      }

      router.refresh();
    }

    run();
  }, [router]);

  return null;
}