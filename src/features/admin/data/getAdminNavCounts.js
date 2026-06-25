import { MODERATION_ROLES, normalizeRole } from "@/features/admin/permissions";
import { createClient } from "@/lib/supabase/server";

export const EMPTY_ADMIN_NAV_COUNTS = {
  reports: 0,
  abuseReports: 0,
  reviews: 0,
  roleReviews: 0,
  total: 0,
};

function toSafeCount(value) {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function normalizeAdminNavCounts(counts) {
  return {
    reports: toSafeCount(counts?.reports),
    abuseReports: toSafeCount(counts?.abuseReports),
    reviews: toSafeCount(counts?.reviews),
    roleReviews: toSafeCount(counts?.roleReviews),
    total: toSafeCount(counts?.total),
  };
}

export async function getAdminNavCounts({ supabase: providedClient, role } = {}) {
  const cleanRole = normalizeRole(role);

  if (!MODERATION_ROLES.includes(cleanRole)) {
    return EMPTY_ADMIN_NAV_COUNTS;
  }

  const supabase = providedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("get_admin_nav_counts");

  if (error) {
    console.error("GET ADMIN NAV COUNTS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return EMPTY_ADMIN_NAV_COUNTS;
  }

  return normalizeAdminNavCounts(data);
}
