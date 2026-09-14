export async function getProfileBadges(supabase, profileIds = []) {
  const ids = [...new Set(profileIds.filter(Boolean))];

  if (ids.length === 0) {
    return {
      badgesByProfileId: new Map(),
      error: null,
    };
  }

  const { data, error } = await supabase.rpc("get_public_profile_badges", {
    p_profile_ids: ids,
  });

  if (error) {
    console.error("GET PROFILE BADGES ERROR:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    return {
      badgesByProfileId: new Map(),
      error,
    };
  }

  const badgesByProfileId = new Map();

  for (const badge of data || []) {
    const existing = badgesByProfileId.get(badge.user_id) || [];
    existing.push(badge);
    badgesByProfileId.set(badge.user_id, existing);
  }

  return {
    badgesByProfileId,
    error: null,
  };
}
