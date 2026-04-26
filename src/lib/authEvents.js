import { supabase } from "@/lib/supabaseClient";

export async function logAuthEvent({
  userId = null,
  email = null,
  eventType,
  success = true,
  errorCode = null,
  errorMessage = null,
  metadata = {},
}) {
  const { error } = await supabase.from("auth_events").insert({
    user_id: userId,
    email,
    event_type: eventType,
    success,
    error_code: errorCode,
    error_message: errorMessage,
    metadata,
  });

  if (error) {
    console.error("Failed to log auth event:", error.message);
    return { success: false, error };
  }

  return { success: true, error: null };
}