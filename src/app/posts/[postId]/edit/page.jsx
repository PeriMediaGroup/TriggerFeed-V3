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

  const { post, currentUserRole, error } = await getPostById(postId);

  if (error || !post) {
    notFound();
  }

  if (post.user_id !== user.id) {
    notFound();
  }

  return (
    <main className="tf-page post-edit-page">
      <section className="tf-section">
        <h1>Edit Post</h1>
        <EditPostForm
          post={post}
          canCreateStickyPost={currentUserRole === "ceo"}
        />
      </section>
    </main>
  );
}
