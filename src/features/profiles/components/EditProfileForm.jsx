// src/features/profiles/components/EditProfileForm.jsx

"use client";

import { useActionState } from "react";
import Link from "next/link";

import { updateProfile } from "@/features/profiles/actions/updateProfile";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

export default function EditProfileForm({ profile }) {
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    initialState
  );

  return (
    <form action={formAction} className="profile-edit-form">
      {state?.message && (
        <p className="profile-edit-form__message">{state.message}</p>
      )}

      <div className="profile-edit-form__field">
        <label htmlFor="display_name">Display Name</label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          defaultValue={profile?.display_name || ""}
          placeholder="Jon Doe"
        />
      </div>

      <div className="profile-edit-form__field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          type="text"
          defaultValue={profile?.username || ""}
          placeholder="Username"
          required
        />
        {state?.errors?.username && (
          <p className="profile-edit-form__error">{state.errors.username}</p>
        )}
      </div>

      <div className="profile-edit-form__field">
        <label htmlFor="first_name">First Name</label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          defaultValue={profile?.first_name || ""}
        />
      </div>

      <div className="profile-edit-form__field">
        <label htmlFor="last_name">Last Name</label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          defaultValue={profile?.last_name || ""}
        />
      </div>

      <div className="profile-edit-form__row">
        <div className="profile-edit-form__field">
          <label htmlFor="city">City</label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue={profile?.city || ""}
          />
        </div>

        <div className="profile-edit-form__field">
          <label htmlFor="state">State</label>
          <input
            id="state"
            name="state"
            type="text"
            defaultValue={profile?.state || ""}
            maxLength={2}
            placeholder="SC"
          />
        </div>
      </div>

      <div className="profile-edit-form__field">
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={profile?.bio || ""}
          rows={5}
          maxLength={500}
          placeholder="Tell people a little about yourself."
        />
        {state?.errors?.bio && (
          <p className="profile-edit-form__error">{state.errors.bio}</p>
        )}
      </div>

      <div className="profile-edit-form__actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Profile"}
        </button>

        <Link href="/profile">Cancel</Link>
      </div>
    </form>
  );
}