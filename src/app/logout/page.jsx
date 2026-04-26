"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { logAuthEvent } from "@/lib/authEvents";

export default function LogoutPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you out...");

  useEffect(() => {
    async function handleLogout() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user || null;

      await logAuthEvent({
        userId: user?.id || null,
        email: user?.email || null,
        eventType: "logout_success",
        success: true,
        metadata: {
          source: "logout_page",
        },
      });

      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatus("We could not sign you out. Please try again.");
        await logAuthEvent({
          userId: user?.id || null,
          email: user?.email || null,
          eventType: "logout_failed",
          success: false,
          errorCode: error.code || null,
          errorMessage: error.message,
          metadata: {
            source: "logout_page",
          },
        });
        return;
      }

      router.replace("/login");
    }

    handleLogout();
  }, [router]);

  return (
    <main style={{ padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      <h1>Logging out</h1>
      <p>{status}</p>
    </main>
  );
}