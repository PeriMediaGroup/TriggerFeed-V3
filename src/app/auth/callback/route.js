import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getSafeRedirectPath(next) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeRedirectPath(requestUrl.searchParams.get("next"));
  const type = requestUrl.searchParams.get("type");

  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("AUTH CALLBACK EXCHANGE ERROR:", exchangeError);
    return NextResponse.redirect(`${origin}/login`);
  }

  if (type === "recovery" || next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password?recovery=1`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("AUTH CALLBACK USER ERROR:", userError);
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile, error: profileError } = await supabase
    .rpc("get_my_profile_auth_status")
    .maybeSingle();

  if (profileError) {
    console.error("AUTH CALLBACK PROFILE ERROR:", profileError);
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  if (!profile) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  if (profile.is_deleted) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/signup`);
  }

  if (profile.is_banned) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login`);
  }

  const redirectPath = next || (profile.username ? "/feed" : "/onboarding");

  return NextResponse.redirect(`${origin}${redirectPath}`);
}
