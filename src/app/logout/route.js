import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
    const supabase = await createClient();

    await supabase.auth.signOut();

    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("loggedOut", "true");

    return NextResponse.redirect(redirectUrl);
}