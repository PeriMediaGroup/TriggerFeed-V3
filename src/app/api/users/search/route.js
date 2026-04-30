// src/app/api/users/search/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ users: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const cleanedQuery = query.replace(/^@/, "");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      display_name,
      first_name,
      last_name,
      avatar_cloudinary_url,
      city,
      state
    `
    )
    .neq("id", user.id)
    .eq("is_deleted", false)
    .or(
      `username.ilike.%${cleanedQuery}%,display_name.ilike.%${cleanedQuery}%,first_name.ilike.%${cleanedQuery}%,last_name.ilike.%${cleanedQuery}%`
    )
    .limit(8);

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