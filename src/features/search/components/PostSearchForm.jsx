import { Search } from "lucide-react";

export default function PostSearchForm({
  defaultQuery = "",
  className = "post-search",
  inputClassName = "post-search__input",
  iconClassName = "post-search__icon",
  placeholder = "Search posts",
  label = "Search posts",
  inputId = "post-search-query",
}) {
  return (
    <form className={className} action="/search">
      <label className="post-search__label" htmlFor={inputId}>
        {label}
      </label>
      <Search className={iconClassName} size={16} strokeWidth={2} aria-hidden />
      <input
        id={inputId}
        className={inputClassName}
        type="search"
        name="q"
        defaultValue={defaultQuery}
        placeholder={placeholder}
        autoComplete="off"
      />
    </form>
  );
}
