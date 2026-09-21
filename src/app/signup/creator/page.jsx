import SignupForm from "@/features/auth/components/SignupForm";

export const metadata = { title: "Creator Signup | TriggerFeed" };

export default function CreatorSignupPage() {
  return <SignupForm profileType="creator" />;
}
