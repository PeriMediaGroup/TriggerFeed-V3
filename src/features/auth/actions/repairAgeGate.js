"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AGE_GATE_VERSION, isValidDobString } from "@/features/auth/ageGate";
import { getUserSafeErrorMessage } from "@/lib/userSafeErrorMessage";

export async function repairAgeGate(formData) {
  const dob = String(formData.get("dob") || "").trim();

  if (!dob) {
    return {
      success: false,
      message: "Please enter your date of birth.",
    };
  }

  if (!isValidDobString(dob)) {
    return {
      success: false,
      message: "Please enter a valid date of birth.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Please log in to verify your age.",
    };
  }

  const { error } = await supabase.rpc("repair_my_age_gate", {
    p_dob: dob,
    p_age_gate_version: AGE_GATE_VERSION,
    p_birthday_messages_enabled: true,
  });

  if (error) {
    return {
      success: false,
      message: getUserSafeErrorMessage(
        error,
        "We could not verify your age. Please try again.",
      ),
    };
  }

  revalidatePath("/profile");
  revalidatePath("/onboarding");

  return {
    success: true,
    message: "Age verified.",
  };
}
