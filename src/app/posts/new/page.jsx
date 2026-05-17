import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import CreatePostForm from "@/features/posts/create";

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

  return (
    <main className="create-post-page">
      <h1>Create Post</h1>
      <CreatePostForm />
    </main>
  );
}