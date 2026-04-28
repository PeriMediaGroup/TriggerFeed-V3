// src/app/posts/page.jsx

import Link from "next/link";
import { getPosts } from "@/features/posts/data/getPosts";
import PostFeed from "@/features/posts/components/PostFeed";

export default async function PostsPage() {
  const { posts, error } = await getPosts();

  return (
    <main className="tf-page posts-page">
      <section className="tf-section">
        <div className="posts-page__header">
          <h1>Posts</h1>
          <Link  href="/posts/new">Create Post</Link>
        </div>

        {error && <p>Posts could not be loaded.</p>}

        <PostFeed posts={posts} />
      </section>
    </main>
  );
}