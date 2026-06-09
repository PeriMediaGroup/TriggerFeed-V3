"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import PostSearchForm from "./PostSearchForm";

export default function MobileHeaderSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = isOpen ? X : Search;

  return (
    <div className="app-header__search">
      <button
        type="button"
        className="app-header__search-toggle"
        aria-label={isOpen ? "Close search" : "Search posts"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Icon size={20} strokeWidth={2} aria-hidden />
      </button>

      {isOpen ? (
        <PostSearchForm
          className="app-header__search-form"
          inputClassName="app-header__search-input"
          iconClassName="app-header__search-icon"
          placeholder="Search posts"
          label="Search posts"
          inputId="mobile-post-search-query"
        />
      ) : null}
    </div>
  );
}
