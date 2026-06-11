import { NextResponse } from "next/server";

function cleanString(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function getSupabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid report request body." },
      { status: 400 },
    );
  }

  const payload = {
    email: cleanString(body?.email, 254),
    link: cleanString(body?.link, 2048),
    offending_username: cleanString(body?.offending_username, 80),
    details: cleanString(body?.details, 4000),
    website: cleanString(body?.website, 200),
  };

  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  if (!payload.email || !payload.link || !payload.details) {
    return NextResponse.json(
      { error: "Email, link, and details are required." },
      { status: 400 },
    );
  }

  const supabaseConfig = getSupabasePublicConfig();

  if (!supabaseConfig.url || !supabaseConfig.key) {
    return NextResponse.json(
      { error: "Report abuse is not configured." },
      { status: 500 },
    );
  }

  const response = await fetch(
    `${supabaseConfig.url}/functions/v1/report-abuse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${supabaseConfig.key}`,
      },
      body: JSON.stringify({
        email: payload.email,
        link: payload.link,
        offending_username: payload.offending_username,
        details: payload.details,
        source: "triggerfeed-v3-legal",
      }),
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Report could not be submitted." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
