import BackLink from "@/components/navigation/BackLink";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPostById } from "@/features/posts/data/getPostById";

import PostDetail from "@/features/posts/components/PostDetail";
import { getCommentsByPostId } from "@/features/comments/queries";
import CommentForm from "@/features/comments/components/CommentForm";
import CommentList from "@/features/comments/components/CommentList";

export default async function PostDetailPage({ params }) {
  const { postId } = await params;

  const user = await getCurrentUser();
  const { post, error } = await getPostById(postId);

  if (error || !post) {
    return (
      <main className="post-detail-page">
        <BackLink label="← Back" fallbackHref="/posts" />
        <p>Post not found.</p>
      </main>
    );
  }

  const { comments, error: commentsError } = await getCommentsByPostId(postId);

  return (
    <main className="post-detail-page">
      <BackLink label="← Back" fallbackHref="/posts" />

      <PostDetail post={post} currentUser={user} />

      <section className="post-detail__comments">
        <CommentForm postId={post.id} isLoggedIn={Boolean(user)} />

        {commentsError && (
          <p className="post-detail__comments-error">
            Could not load comments: {commentsError}
          </p>
        )}

        <CommentList
          comments={comments}
          currentUserId={user?.id || null}
          postId={post.id}
        />
      </section>
    </main>
  );
}
