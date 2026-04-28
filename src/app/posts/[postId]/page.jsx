// src/app/posts/[postId]/page.jsx
import Image from "next/image";
import Link from "next/link";
import { getPostById } from "@/features/posts/data/getPostById";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

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
        <p>Post not found.</p>
      </main>
    );
  }

  const authorName =
    post.author?.username || post.author?.first_name || "Unknown user";

  const { comments, error: commentsError } = await getCommentsByPostId(postId);

  return (
    <main className="post-detail-page">
      <Link href="/posts" className="post-detail-page__back-link">
        ← Back to posts
      </Link>
      <article className="post-detail">
        <header className="post-detail__header">
          <p className="post-detail__author">{authorName}</p>
          <h1 className="post-detail__title">{post.title}</h1>
        </header>

        {post.description && (
          <p className="post-detail__description">{post.description}</p>
        )}

        {post.image_url && (
          <Image
            className="post-detail__image"
            src={post.image_url}
            alt={post.title || "Post image"}
          />
        )}
      </article>

      <section className="post-detail__comments">
        <CommentForm postId={postId} isLoggedIn={!!user} />

        {commentsError && (
          <p className="post-detail__comments-error">
            Could not load comments: {commentsError}
          </p>
        )}

        <CommentList comments={comments} />
      </section>
    </main>
  );
}
