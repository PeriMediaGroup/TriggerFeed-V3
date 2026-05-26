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
    console.error("USER SEARCH FRIEND CHECK ERROR:", {
      code: friendRowsError.code,
      message: friendRowsError.message,
      details: friendRowsError.details,
      hint: friendRowsError.hint,
    });

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
      username,
      display_name,
      first_name,
      last_name,
      avatar_cloudinary_url
    `
    )
    .not("username", "is", null)
    .ilike("username_lower", `${cleanedQuery}%`)
    .order("username_lower", { ascending: true })
    .limit(8);

  for (const excludedUserId of excludedUserIds) {
    queryBuilder = queryBuilder.neq("id", excludedUserId);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error("USER SEARCH ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return NextResponse.json({ users: [] }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}
