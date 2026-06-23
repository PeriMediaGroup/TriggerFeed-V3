// src/lib/supabase/proxy.js

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/about",
  "/account-deleted",
  "/contact",
  "/delete-account",
  "/forgot-password",
  "/install",
  "/legal",
  "/login",
  "/merch",
  "/reset-password",
  "/signup",
  "/welcome",
]);

function isPublicPage(pathname) {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/signup/")
  );
}

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    }
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const hasAuthenticatedUser = Boolean(claimsData?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  if (!hasAuthenticatedUser && !isApiRoute && !isPublicPage(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/welcome";
    redirectUrl.search = "";

    const redirectResponse = NextResponse.redirect(redirectUrl);

    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
