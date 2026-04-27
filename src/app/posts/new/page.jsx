// src/app/posts/new/page.jsx

import CreatePostForm from "@/features/posts/components/CreatePostForm";

export default function NewPostPage() {
  return (
    <main className="tf-page posts-new-page">
      <section className="tf-section">
        <h1>Create Post</h1>
        <CreatePostForm />
      </section>
    </main>
  );
}