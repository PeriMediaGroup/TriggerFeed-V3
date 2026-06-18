import PostSearchForm from "@/features/search/components/PostSearchForm";
import FriendSuggestions from "@/features/friends/components/FriendSuggestions";
import AdSlot from "@/features/ads/components/AdSlot";
import { getFriendSuggestions } from "@/features/friends/data/getFriendSuggestions";

export default async function AppRightRail({ user = null }) {
  const viewerId = user?.id || null;
  const { suggestions, error, didFetch } = await getFriendSuggestions({
    limit: 4,
    viewerId,
  });

  return (
    <div className="app-right-rail">
      <PostSearchForm
        className="app-right-rail__search"
        inputClassName="app-right-rail__search-input"
        iconClassName="app-right-rail__search-icon"
        placeholder="Search posts"
        inputId="right-rail-post-search-query"
      />
      <FriendSuggestions
        key={viewerId || "signed-out"}
        viewerId={viewerId}
        suggestions={suggestions}
        hasError={Boolean(error)}
        didFetch={didFetch}
      />
      <section className="app-right-rail__module">
        <AdSlot slot="right-sidebar-small" />
      </section>
    </div>
  );
}
