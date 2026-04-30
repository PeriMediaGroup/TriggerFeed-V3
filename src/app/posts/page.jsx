// src/app/posts/page.jsx

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPosts } from "@/features/posts/data/getPosts";
import PostFeed from "@/features/posts/components/PostFeed";

export default async function PostsPage() {
  const user = await getCurrentUser();
  const { posts, error } = await getPosts();

  return (
    <main className="tf-page posts-page">
      <section className="tf-section">
        {error && <p>Posts could not be loaded.</p>}
        <PostFeed posts={posts} />
      </section>
    </main>
  );
}