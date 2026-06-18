import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_SOURCE = "triggerfeed-v3-legal";

function cleanString(value: unknown, maxLength: number) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid report request." }, 400);
  }

  const payload = {
    email: cleanString(body.email, 254).toLowerCase(),
    link: cleanString(body.link, 2048),
    offending_username: cleanString(body.offending_username, 80) || null,
    details: cleanString(body.details, 4000),
    source: cleanString(body.source, 120) || DEFAULT_SOURCE,
  };

  if (
    !isValidEmail(payload.email) ||
    !isValidHttpUrl(payload.link) ||
    payload.details.length < 10
  ) {
    return jsonResponse({ error: "Invalid report details." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("REPORT ABUSE CONFIG ERROR:", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });

    return jsonResponse({ error: "Could not submit report." }, 500);
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/abuse_reports`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("REPORT ABUSE INSERT ERROR:", {
        status: response.status,
        body: await response.text(),
      });

      return jsonResponse({ error: "Could not submit report." }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("REPORT ABUSE FUNCTION ERROR:", error);

    return jsonResponse({ error: "Could not submit report." }, 500);
  }
});
