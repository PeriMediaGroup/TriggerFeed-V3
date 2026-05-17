"use client";

import { CREATE_POST_EMOJIS } from "../constants/createPostEmojis";

export default function CreatePostEmojiPicker({ onSelectEmoji }) {
  return (
    <div className="create-post__emoji-picker" aria-label="Emoji picker">
      {CREATE_POST_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="create-post__emoji-button"
          onClick={() => onSelectEmoji(emoji)}
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}