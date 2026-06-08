export async function getCurrentUserModerationBlock(supabase) {
  const { error } = await supabase.rpc("assert_current_user_can_interact");

  if (error) {
    console.error("CURRENT USER MODERATION STATUS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      blocked: true,
      message: error.message || "Could not verify your account status.",
    };
  }

  return {
    blocked: false,
    message: "",
  };
}
