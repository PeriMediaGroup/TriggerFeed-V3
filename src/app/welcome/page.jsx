import { createClient } from "@/lib/supabase/server";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import WelcomeLanding from "@/features/welcome/WelcomeLanding";
import { getWelcomeLinks } from "@/features/welcome/welcomeLinks";

const title = "TriggerFeed | The Firearms Community";
const description =
  "Join TriggerFeed, a social community for gun owners, shooters, creators, trainers, manufacturers, ranges, retailers, and firearms organizations.";

export const metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/welcome" },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/welcome`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: { card: "summary", title, description },
};

export default async function WelcomePage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <WelcomeLanding
      links={getWelcomeLinks(await searchParams)}
      isAuthenticated={Boolean(user)}
    />
  );
}
