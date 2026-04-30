// src/features/profiles/components/EditTopGuns.jsx

"use client";

import { useActionState, useMemo, useState } from "react";
import { updateTopGuns } from "@/features/profiles/actions/updateTopGuns";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

function createBlankSlots(existingGuns = []) {
  const names = existingGuns
    .map((gun) => gun.name || "")
    .filter(Boolean)
    .slice(0, 4);

  while (names.length < 4) {
    names.push("");
  }

  return names;
}

export default function EditTopGuns({ currentTopGuns = [] }) {
  const [state, formAction, isPending] = useActionState(
    updateTopGuns,
    initialState
  );

  const initialGunNames = useMemo(
    () => createBlankSlots(currentTopGuns),
    [currentTopGuns]
  );

  const [gunNames, setGunNames] = useState(initialGunNames);

  function updateGunName(index, value) {
    setGunNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function clearGun(index) {
    setGunNames((current) => {
      const next = [...current];
      next[index] = "";
      return next;
    });
  }

  function moveGun(index, direction) {
    setGunNames((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

      return next;
    });
  }

  return (
    <section className="edit-top-guns">
      <h2>Top Guns</h2>
      <p>Add up to 4 favorite guns to show on your profile.</p>

      {state?.message && (
        <p className="edit-top-guns__message">{state.message}</p>
      )}

      {state?.errors?.top_guns && (
        <p className="edit-top-guns__error">{state.errors.top_guns}</p>
      )}

      <form action={formAction} className="edit-top-guns__form">
        <ol className="edit-top-guns__list">
          {gunNames.map((name, index) => {
            const isFirst = index === 0;
            const isLast = index === gunNames.length - 1;

            return (
              <li key={`top-gun-${index}`} className="edit-top-guns__item">


                <input
                  id={`top-gun-${index}`}
                  name="top_gun_names"
                  type="text"
                  value={name}
                  onChange={(event) => updateGunName(index, event.target.value)}
                  maxLength={60}
                  placeholder={
                    index === 0
                      ? "Cap"
                      : index === 1
                        ? "Laser"
                        : index === 2
                          ? "Big"
                          : "Strong"
                  }
                />

                <div className="edit-top-guns__actions">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => moveGun(index, "up")}
                    aria-label={`Move top gun ${index + 1} up`}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => moveGun(index, "down")}
                    aria-label={`Move top gun ${index + 1} down`}
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    onClick={() => clearGun(index)}
                    aria-label={`Clear top gun ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Top Guns"}
        </button>
      </form>
    </section>
  );
}