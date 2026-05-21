"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/authEvents";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing sign in...");

  useEffect(() => {
    const supabase = createClient();
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("We could not finish signing you in. Please try logging in.");
        await logAuthEvent({
          eventType: "auth_callback_failed",
          success: false,
          errorCode: error.code || null,
          errorMessage: error.message,
          metadata: {
            source: "auth_callback",
          },
        });

        router.replace("/login");
        return;
      }

      const user = data.session?.user;

      if (!user) {
        setStatus("Email verified. Please log in.");
        router.replace("/login");
        return;
      }

      await logAuthEvent({
        userId: user.id,
        email: user.email,
        eventType: "auth_callback_success",
        success: true,
        metadata: {
          source: "auth_callback",
        },
      });

      const { data: profile, error: profileError } = await supabase
        .rpc("get_my_profile_auth_status")
        .single();

      if (profileError || !profile) {
        setStatus("Your account is verified, but your profile needs setup.");
        router.replace("/login");
        return;
      }

      if (profile.is_deleted) {
        setStatus("This account is no longer active.");
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (profile.is_banned) {
        setStatus("This account is not available.");
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      if (!profile.username) {
        router.replace("/onboarding");
        return;
      }

      router.replace("/feed");
    }

    handleCallback();
  }, [router]);

  return (
    <main style={{ padding: "2rem", maxWidth: "520px", margin: "0 auto" }}>
      <h1>TriggerFeed</h1>
      <p>{status}</p>
    </main>
  );
}
