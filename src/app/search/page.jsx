import PostFeed from "@/features/posts/components/PostFeed";
import { searchPosts } from "@/features/posts/data/getPosts";
import PostSearchForm from "@/features/search/components/PostSearchForm";

export const metadata = {
  title: "Search Posts | TriggerFeed",
};

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const requestedQuery = typeof params?.q === "string" ? params.q : "";

  const {
    posts,
    commentsByPostId,
    currentUserId,
    query,
    message,
  } = await searchPosts({ query: requestedQuery });

  return (
    <section className="post-search-page">
      <header className="post-search-page__header">
        <div>
          <h1>Search Posts</h1>
          <p>Search by title or post body.</p>
        </div>

        <PostSearchForm
          defaultQuery={query}
          className="post-search-page__form"
          inputClassName="post-search-page__input"
          iconClassName="post-search-page__icon"
          placeholder="Search posts"
          inputId="search-page-post-query"
        />
      </header>

      {query && posts.length > 0 ? (
        <p className="post-search-page__summary">
          {posts.length} result{posts.length === 1 ? "" : "s"} for &quot;
          {query}&quot;
        </p>
      ) : null}

      {message ? <p className="post-search-page__empty">{message}</p> : null}

      {posts.length > 0 ? (
        <PostFeed
          posts={posts}
          commentsByPostId={commentsByPostId}
          currentUserId={currentUserId}
        />
      ) : null}
    </section>
  );
}
