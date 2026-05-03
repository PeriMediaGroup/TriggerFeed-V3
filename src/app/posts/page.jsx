// src/app/posts/page.jsx

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPosts } from "@/features/posts/data/getPosts";
import { getCommentsByPostId } from "@/features/comments/queries";
import PostFeed from "@/features/posts/components/PostFeed";

export default async function PostsPage() {
  const user = await getCurrentUser();
  const { posts, error } = await getPosts();

  const safePosts = posts || [];

  const commentResults = await Promise.all(
    safePosts.map(async (post) => {
      const { comments } = await getCommentsByPostId(post.id);

      return {
        postId: post.id,
        comments: comments || [],
      };
    })
  );

  const commentsByPostId = commentResults.reduce((grouped, result) => {
    grouped[result.postId] = result.comments;
    return grouped;
  }, {});

  return (
    <main className="tf-page posts-page">
      <section className="tf-section">
        {error && <p>Posts could not be loaded.</p>}

        <PostFeed
          posts={safePosts}
          commentsByPostId={commentsByPostId}
          currentUserId={user?.id || null}
        />
      </section>
    </main>
  );
}