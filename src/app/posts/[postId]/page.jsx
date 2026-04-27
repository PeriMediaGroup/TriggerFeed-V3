// src/app/posts/[postId]/page.jsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostById } from "@/features/posts/data/getPostById";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import PostActions from "@/features/posts/components/PostActions";

export default async function PostDetailPage({ params }) {
  const { postId } = await params;

  const user = await getCurrentUser();
  const { post, error } = await getPostById(postId);
  const authorName =
    post.author?.username || post.author?.first_name || "Unknown user";

  if (error || !post) {
    notFound();
  }

  const isOwner = user?.id === post.user_id;

  return (
    <main className="tf-page post-detail-page">
      <section className="tf-section post-detail">
        <p className="post-detail__back">
          <Link href="/posts">← Back to Posts</Link>
        </p>

        <article className="post-detail__card">
          <header className="post-detail__header">
            <p>
              Posted by <strong>{authorName}</strong>
            </p>
            <h1>{post.title}</h1>

            <p className="post-detail__meta">
              Posted {new Date(post.created_at).toLocaleDateString()}
            </p>
          </header>

          {post.body && <p className="post-detail__body">{post.body}</p>}

          <footer className="post-detail__footer">
            <span className="post-detail__visibility">
              Visibility: {post.visibility}
            </span>

            {isOwner && <PostActions postId={post.id} />}
          </footer>
        </article>
      </section>
    </main>
  );
}
