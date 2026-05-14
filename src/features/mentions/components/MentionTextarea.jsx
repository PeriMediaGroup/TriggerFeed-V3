"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchMentionProfiles } from "../actions/searchMentionProfiles";

function getMentionQueryBeforeCursor(value, cursorPosition) {
  const safeValue = typeof value === "string" ? value : "";
  const textBeforeCursor = value.slice(0, cursorPosition);

  const match = textBeforeCursor.match(/(^|[\s([{])@([a-zA-Z0-9_-]{1,30})$/);

  if (!match) {
    return null;
  }

  return {
    query: match[2],
    startIndex: textBeforeCursor.lastIndexOf("@"),
  };
}

export default function MentionTextarea({
  id,
  name,
  value,
  onChange,
  placeholder,
  className,
  rows = 4,
  required = false,
  maxLength,
  disabled = false,
}) {
  const textareaRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionState, setMentionState] = useState(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || disabled) {
      setSuggestions([]);
      return;
    }

    const cursorPosition = textarea.selectionStart;
    const mention = getMentionQueryBeforeCursor(value || "", cursorPosition);

    setMentionState(mention);
    setActiveIndex(0);

    if (!mention?.query) {
      setSuggestions([]);
      return;
    }

    startTransition(async () => {
      const result = await searchMentionProfiles(mention.query);

      if (result.success) {
        setSuggestions(result.profiles);
      } else {
        setSuggestions([]);
      }
    });
  }, [value, disabled]);

  function emitChange(nextValue) {
    onChange({
      target: {
        name,
        value: nextValue,
      },
    });
  }

  function insertMention(profile) {
    const textarea = textareaRef.current;

    if (!textarea || !mentionState || !profile?.username) return;

    const currentValue = value || "";
    const cursorPosition = textarea.selectionStart;

    const beforeMention = currentValue.slice(0, mentionState.startIndex);
    const afterCursor = currentValue.slice(cursorPosition);

    const nextValue = `${beforeMention}@${profile.username} ${afterCursor}`;
    const nextCursorPosition =
      beforeMention.length + profile.username.length + 2;

    emitChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });

    setSuggestions([]);
    setMentionState(null);
  }

  function handleKeyDown(event) {
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();

      setActiveIndex((current) =>
        current + 1 >= suggestions.length ? 0 : current + 1
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      setActiveIndex((current) =>
        current - 1 < 0 ? suggestions.length - 1 : current - 1
      );
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertMention(suggestions[activeIndex]);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSuggestions([]);
      setMentionState(null);
    }
  }

  return (
    <div className="mention-textarea">
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
      />

      {suggestions.length > 0 && (
        <div className="mention-textarea__menu">
          {suggestions.map((profile, index) => (
            <button
              type="button"
              key={profile.id}
              className={
                index === activeIndex
                  ? "mention-textarea__option mention-textarea__option--active"
                  : "mention-textarea__option"
              }
              onMouseDown={(event) => {
                event.preventDefault();
                insertMention(profile);
              }}
            >
              {profile.avatar_cloudinary_url ? (
                <img
                  src={profile.avatar_cloudinary_url}
                  alt=""
                  className="mention-textarea__avatar"
                />
              ) : (
                <span className="mention-textarea__avatar mention-textarea__avatar--fallback">
                  {profile.username?.charAt(0)?.toUpperCase() || "?"}
                </span>
              )}

              <span className="mention-textarea__user">
                <strong>@{profile.username}</strong>

                {profile.first_name && <span>{profile.first_name}</span>}
              </span>
            </button>
          ))}

          {isPending && (
            <div className="mention-textarea__loading">Searching...</div>
          )}
        </div>
      )}
    </div>
  );
}