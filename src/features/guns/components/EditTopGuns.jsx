// src/features/guns/components/EditTopGuns.jsx

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");
  const saveTimerRef = useRef(null);

  const initialGunNames = useMemo(
    () => createBlankSlots(currentTopGuns),
    [currentTopGuns],
  );

  const [gunNames, setGunNames] = useState(initialGunNames);

  function saveTopGuns(nextGunNames, debounce = false) {
    setGunNames(nextGunNames);
    setSaveMessage("Saving...");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const runSave = () => {
      startTransition(async () => {
        const formData = new FormData();

        nextGunNames.forEach((name) => {
          formData.append("top_gun_names", name);
        });

        const result = await updateTopGuns(initialState, formData);

        if (result?.success) {
          setSaveMessage("Saved");
          return;
        }

        setSaveMessage(result?.message || "Could not save top guns.");
      });
    };

    if (debounce) {
      saveTimerRef.current = setTimeout(runSave, 600);
      return;
    }

    runSave();
  }

  function updateGunName(index, value) {
    setGunNames((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function saveGunNames(nextGunNames) {
    setSaveMessage("Saving...");

    startTransition(async () => {
      const formData = new FormData();

      nextGunNames.forEach((name) => {
        formData.append("top_gun_names", name);
      });

      const result = await updateTopGuns(initialState, formData);

      if (result?.success) {
        setSaveMessage("Saved");
        return;
      }

      setSaveMessage(result?.message || "Could not save top guns.");
    });
  }

  function saveCurrentGunNames() {
    saveGunNames(gunNames);
  }

  function clearGun(index) {
    const next = [...gunNames];
    next[index] = "";

    setGunNames(next);
    saveGunNames(next);
  }

  function moveGun(index, direction) {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= gunNames.length) {
      return;
    }

    const next = [...gunNames];

    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    setGunNames(next);
    saveGunNames(next);
  }

  return (
    <section className="edit-top-guns">
      <div className="edit-top-guns__header">
        <div>
          <h3>Manage Top Guns</h3>
          <p>Add up to 4 favorite guns for your profile showcase.</p>
        </div>

        {saveMessage && (
          <span
            className={`edit-top-guns__status ${
              isPending ? "is-saving" : "is-saved"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>

      <ol className="edit-top-guns__list">
        {gunNames.map((name, index) => {
          const isFirst = index === 0;
          const isLast = index === gunNames.length - 1;

          return (
            <li key={`top-gun-${index}`} className="edit-top-guns__item">
              <span className="edit-top-guns__rank">{index + 1}</span>

              <input
                id={`top-gun-${index}`}
                name="top_gun_names"
                type="text"
                value={name}
                onChange={(event) => updateGunName(index, event.target.value)}
                onBlur={saveCurrentGunNames}
                maxLength={60}
                placeholder="Favorite handgun"
              />

              <div className="edit-top-guns__actions">
                <button
                  type="button"
                  disabled={isFirst || isPending}
                  onClick={() => moveGun(index, "up")}
                  aria-label={`Move top gun ${index + 1} up`}
                >
                  ↑
                </button>

                <button
                  type="button"
                  disabled={isLast || isPending}
                  onClick={() => moveGun(index, "down")}
                  aria-label={`Move top gun ${index + 1} down`}
                >
                  ↓
                </button>

                <button
                  type="button"
                  disabled={!name || isPending}
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

      <p className="edit-top-guns__hint">
        Changes save automatically. Because manually saving four text fields is
        how software becomes a DMV form.
      </p>
    </section>
  );
}
