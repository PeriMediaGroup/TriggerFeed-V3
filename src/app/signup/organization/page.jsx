import SignupForm from "@/features/auth/components/SignupForm";

export const metadata = { title: "Organization Signup | TriggerFeed" };

export default function OrganizationSignupPage() {
  return <SignupForm profileType="organization" />;
}
