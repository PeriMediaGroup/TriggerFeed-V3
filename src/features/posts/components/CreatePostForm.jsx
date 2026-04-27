// src/features/posts/components/CreatePostForm.jsx

"use client";

import { useState, useTransition } from "react";
import { createPost } from "../actions/createPost";

export default function CreatePostForm() {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setErrors({});
      setStatus("");

      const result = await createPost(formData);

      if (!result.success) {
        setErrors(result.errors || {});
        setStatus(result.message || "Something went wrong.");
        return;
      }

      event.target.reset();
      setStatus("Post created.");
    });
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="post-form__field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={120} required />
        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <div className="post-form__field">
        <label htmlFor="body">Body</label>
        <textarea id="body" name="body" rows={6} maxLength={5000} />
        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <div className="post-form__field">
        <label htmlFor="visibility">Visibility</label>
        <select id="visibility" name="visibility" defaultValue="public">
          <option value="public">Public</option>
          <option value="friends">Friends</option>
          <option value="private">Private</option>
        </select>
        {errors.visibility && (
          <p className="post-form__error">{errors.visibility}</p>
        )}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? "Posting..." : "Create Post"}
      </button>

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}
