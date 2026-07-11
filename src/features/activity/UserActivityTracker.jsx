"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;
const MIN_TOUCH_INTERVAL_MS = 2 * 60 * 1000;

export default function UserActivityTracker({ userId }) {
  const lastTouchAtRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const supabase = createClient();
    let cancelled = false;

    async function touchActivity({ force = false } = {}) {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();

      if (!force && now - lastTouchAtRef.current < MIN_TOUCH_INTERVAL_MS) {
        return;
      }

      lastTouchAtRef.current = now;

      try {
        await supabase.rpc("touch_user_activity");
      } catch {}
    }

    function clearHeartbeat() {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function startHeartbeat() {
      clearHeartbeat();

      if (document.visibilityState === "hidden") {
        return;
      }

      intervalRef.current = window.setInterval(() => {
        void touchActivity();
      }, HEARTBEAT_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void touchActivity({ force: true });
        startHeartbeat();
      } else {
        clearHeartbeat();
      }
    }

    void touchActivity({ force: true });
    startHeartbeat();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId]);

  return null;
}
