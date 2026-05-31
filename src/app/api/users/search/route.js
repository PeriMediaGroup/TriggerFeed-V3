// src/app/api/users/search/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function cleanSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\w.-]/g, "")
    .toLowerCase();
}

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

export async function GET(request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ users: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cleanedQuery = cleanSearchQuery(searchParams.get("q"));

  if (cleanedQuery.length < 1) {
    return NextResponse.json({ users: [] });
  }

  const { data: friendRows, error: friendRowsError } = await supabase
    .from("friends")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (friendRowsError) {
    logSupabaseError("USER SEARCH FRIEND CHECK ERROR:", friendRowsError);

    return NextResponse.json({ users: [] }, { status: 500 });
  }

  const excludedUserIds = new Set([user.id]);

  for (const row of friendRows || []) {
    const otherUserId =
      row.requester_id === user.id ? row.addressee_id : row.requester_id;

    if (otherUserId) {
      excludedUserIds.add(otherUserId);
    }
  }

  let queryBuilder = supabase
    .from("profiles")
    .select(
      `
      id,
      username
    `
    )
    .not("username", "is", null)
    .ilike("username_lower", `${cleanedQuery}%`)
    .order("username_lower", { ascending: true })
    .limit(8);

  for (const excludedUserId of excludedUserIds) {
    queryBuilder = queryBuilder.neq("id", excludedUserId);
  }

  const { data: profileMatches, error } = await queryBuilder;

  if (error) {
    logSupabaseError("USER SEARCH ERROR:", error);

    return NextResponse.json({ users: [] }, { status: 500 });
  }

  const profileIds = (profileMatches || []).map((profile) => profile.id);

  if (!profileIds.length) {
    return NextResponse.json({ users: [] });
  }

  const { data: profiles, error: profilesError } = await supabase.rpc(
    "get_public_profile_cards",
    {
      p_profile_ids: profileIds,
    }
  );

  if (profilesError) {
    logSupabaseError("USER SEARCH PROFILE CARDS ERROR:", profilesError);

    return NextResponse.json({ users: [] }, { status: 500 });
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const users = profileIds
    .map((profileId) => profileMap.get(profileId))
    .filter(Boolean);

  return NextResponse.json({ users });
}
