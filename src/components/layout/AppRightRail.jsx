import PostSearchForm from "@/features/search/components/PostSearchForm";

export default function AppRightRail() {
  return (
    <div className="app-right-rail">
      <PostSearchForm
        className="app-right-rail__search"
        inputClassName="app-right-rail__search-input"
        iconClassName="app-right-rail__search-icon"
        placeholder="Search posts"
        inputId="right-rail-post-search-query"
      />
      <div className="temp-block">trending posts</div>
      <div className="temp-block temp-block--md">Friend --medium</div>
      <div className="temp-block temp-block--skyscraper">
        temp block --skyscraper
      </div>
    </div>
  );
}
