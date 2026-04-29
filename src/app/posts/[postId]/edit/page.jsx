// src/app/posts/[postId]/edit/page.jsx

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPostById } from "@/features/posts/data/getPostById";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import EditPostForm from "@/features/posts/components/EditPostForm";

export default async function EditPostPage({ params }) {
  const { postId } = await params;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { post, error } = await getPostById(postId);

  if (error || !post) {
    notFound();
  }

  if (post.user_id !== user.id) {
    notFound();
  }

  return (
    <main className="tf-page post-edit-page">
      <section className="tf-section">
        <p>
          <Link href={`/posts/${post.id}`} replace>
            ← Back to post
          </Link>
        </p>

        <h1>Edit Post</h1>

        <EditPostForm post={post} />
      </section>
    </main>
  );
}
