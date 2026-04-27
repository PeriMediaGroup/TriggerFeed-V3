// src/app/posts/[postId]/page.jsx

import { notFound } from "next/navigation";
import { getPostById } from "@/features/posts/data/getPostById";

export default async function PostDetailPage({ params }) {
  const { postId } = await params;

  const { post, error } = await getPostById(postId);

  if (error || !post) {
    notFound();
  }

  return (
    <main className="tf-page post-detail-page">
      <article className="tf-section post-detail">
        <header className="post-detail__header">
          <h1>{post.title}</h1>

          <p className="post-detail__meta">
            {new Date(post.created_at).toLocaleDateString()}
          </p>
        </header>

        {post.body && <p className="post-detail__body">{post.body}</p>}

        <footer className="post-detail__footer">
          <span className="post-detail__visibility">{post.visibility}</span>
        </footer>
      </article>
    </main>
  );
}