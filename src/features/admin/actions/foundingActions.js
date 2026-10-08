"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ERRORS = [
  "User is not a Founding member",
  "Founding number changed; refresh and confirm again",
  "Founding registry has gaps or retired slots; CEO repair required first",
  "Ambiguous Founding registry ownership; manual review required",
  "Founding registry mismatch; CEO review required",
  "Founding 500 is finalized; renumbering is prohibited",
  "Founding 500 is already finalized",
];

async function execute(rpc, payload) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { ok: false, message: "Please sign in again." };
    const { data, error } = await supabase.rpc(rpc, payload);
    if (error) return {
      ok: false,
      message: error.code === "42501" ? "You do not have permission for this operation."
        : SAFE_ERRORS.includes(error.message) ? error.message : "Founding operation failed. Refresh and try again.",
    };
    revalidatePath("/admin/founding-500");
    revalidatePath("/admin/users");
    revalidatePath("/founding-500");
    revalidatePath("/profiles/[userId]", "page");
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Could not confirm the result. Refresh before trying again." };
  }
}

export async function removeFoundingStatus({ userId, number, reason = "" }) {
  if (!UUID.test(userId) || !Number.isInteger(number) || number < 1 || number > 500 || typeof reason !== "string" || reason.length > 2000) {
    return { ok: false, message: "Invalid removal details." };
  }
  return execute("remove_founding_500_member", { p_user_id: userId, p_expected_number: number, p_reason: reason.trim() || null });
}

export async function maintainFounding500({ operation, confirmation, reason = "" }) {
  const required = operation === "repair" ? "REPAIR FOUNDING 500" : "FINALIZE FOUNDING 500";
  if (!["repair", "finalize"].includes(operation) || confirmation !== required || typeof reason !== "string" || reason.length > 2000) {
    return { ok: false, message: "Explicit confirmation is required." };
  }
  return execute(operation === "repair" ? "repair_founding_500" : "finalize_founding_500", {
    p_confirmation: confirmation, p_reason: reason.trim() || null,
  });
}
