import { redirect } from "next/navigation";

import { normalizeAttributionToken } from "@/features/marketing/attribution";

export default async function JoinPage({ searchParams }) {
  const params = await searchParams;
  const source = normalizeAttributionToken(params?.source || "");
  const campaign = normalizeAttributionToken(params?.campaign || "");
  const signupParams = new URLSearchParams();

  if (source) {
    signupParams.set("source", source);
  }

  if (campaign) {
    signupParams.set("campaign", campaign);
  }

  const query = signupParams.toString();

  redirect(query ? `/signup?${query}` : "/signup");
}
