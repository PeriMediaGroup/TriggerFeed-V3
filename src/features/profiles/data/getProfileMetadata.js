function normalizeProfileMetadata(row) {
  if (!row?.user_id) {
    return null;
  }

  return {
    user_id: row.user_id,
    profile_type: row.profile_type || "member",
    category: row.category || null,
    subtype: row.subtype || null,
    website_url: row.website_url || null,
    primary_link_url: row.primary_link_url || null,
    primary_link_label: row.primary_link_label || null,
    social_links: Array.isArray(row.social_links) ? row.social_links : [],
    public_contact_email: row.public_contact_email || null,
    public_contact_phone: row.public_contact_phone || null,
    public_location: row.public_location || null,
  };
}

export async function getProfileMetadata(supabase, profileIds = []) {
  const ids = [...new Set(profileIds.filter(Boolean))];

  if (ids.length === 0) {
    return { metadataByProfileId: new Map(), error: null };
  }

  const { data, error } = await supabase.rpc("get_public_profile_metadata", {
    p_profile_ids: ids,
  });

  if (error) {
    console.error("GET PROFILE METADATA ERROR:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    return { metadataByProfileId: new Map(), error };
  }

  const metadataByProfileId = new Map();

  for (const row of data || []) {
    const metadata = normalizeProfileMetadata(row);

    if (metadata) {
      metadataByProfileId.set(metadata.user_id, metadata);
    }
  }

  return { metadataByProfileId, error: null };
}
