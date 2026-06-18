export function getUserSafeErrorMessage(
  error,
  fallback = "Something went wrong.",
  permissionFallback = "You do not have permission to do that.",
) {
  const rawMessage = String(error?.message ?? error ?? "");
  const message = rawMessage.toLowerCase();

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "Email or password is incorrect.";
  }

  if (
    message.includes("email not confirmed") ||
    message.includes("email_confirmed")
  ) {
    return "Please confirm your email before signing in.";
  }

  if (
    message.includes("permission") ||
    message.includes("rls") ||
    message.includes("row-level security") ||
    message.includes("policy violation") ||
    message.includes("not authorized")
  ) {
    return permissionFallback;
  }

  if (message.includes("network") || message.includes("fetch failed")) {
    return "Network error. Please check your connection and try again.";
  }

  if (error?.code === "23505" || message.includes("duplicate key")) {
    return "That already exists.";
  }

  return fallback;
}
