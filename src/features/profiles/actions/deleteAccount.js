"use server";

import { createClient } from "@/lib/supabase/server";

function logSupabaseError(label, error) {
  console.error(label, {
    raw: error,
    name: error?.name,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

export async function deleteMyAccount(confirmText) {
  if (confirmText !== "DELETE") {
    return {
      success: false,
      message: "Type DELETE to confirm account deletion.",
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
      message: "You must be logged in to delete your account.",
    };
  }

  const { data, error } = await supabase
    .rpc("soft_delete_my_account")
    .maybeSingle();

  if (error) {
    logSupabaseError("DELETE ACCOUNT ERROR:", error);

    return {
      success: false,
      message: "Could not delete your account. Please contact support.",
    };
  }

  if (!data?.is_deleted) {
    return {
      success: false,
      message: "Your account was already deleted or could not be updated.",
    };
  }

  const { error: signOutError } = await supabase.auth.signOut();

  if (signOutError) {
    logSupabaseError("DELETE ACCOUNT SIGN OUT ERROR:", signOutError);
  }

  return {
    success: true,
  };
}
