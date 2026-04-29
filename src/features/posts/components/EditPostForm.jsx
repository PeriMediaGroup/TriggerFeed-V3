// src/features/posts/components/EditPostForm.jsx

"use client";

import { useState, useTransition } from "react";
import { updatePost } from "../actions/updatePost";

export default function EditPostForm({ post }) {
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setErrors({});
      setStatus("");

      const result = await updatePost(post.id, formData);

      if (result && !result.success) {
        setErrors(result.errors || {});
        setStatus(result.message || "Something went wrong.");
      }
    });
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="post-form__field">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={120}
          required
          defaultValue={post.title}
        />
        {errors.title && <p className="post-form__error">{errors.title}</p>}
      </div>

      <div className="post-form__field">
        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={post.body || ""}
        />
        {errors.body && <p className="post-form__error">{errors.body}</p>}
      </div>

      <input type="hidden" name="visibility" value="public" />
      {errors.visibility && (
        <p className="post-form__error">{errors.visibility}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Changes"}
      </button>

      {status && <p className="post-form__status">{status}</p>}
    </form>
  );
}
