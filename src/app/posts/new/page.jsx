import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import CreatePostForm from "@/features/posts/create";
import { createClient } from "@/lib/supabase/server";

export default async function NewPostPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="create-post-page">
        <h1>Create Post</h1>

        <section className="create-post-page__auth-required">
          <p>You need to be logged in to create a post.</p>

          <Link href="/login">Log in to continue</Link>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: authStatus } = await supabase
    .rpc("get_my_profile_auth_status")
    .single();

  const canCreateStickyPost = authStatus?.role === "ceo";

  return (
    <main className="create-post-page">
      <h1>Create Post</h1>
      <CreatePostForm canCreateStickyPost={canCreateStickyPost} />
    </main>
  );
}
