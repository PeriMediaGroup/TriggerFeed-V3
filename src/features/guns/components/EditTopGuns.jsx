"use client";

import Image from "next/image";
import { Crosshair, ImagePlus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { updateTopGuns } from "@/features/profiles/actions/updateTopGuns";
import {
  removeTopGunImage,
  updateTopGunImage,
} from "@/features/profiles/actions/updateTopGunImage";

const initialState = {
  success: false,
  message: "",
  errors: {},
};

function createBlankSlots(existingGuns = []) {
  const slots = existingGuns.slice(0, 4).map((gun) => ({ ...gun }));

  while (slots.length < 4) {
    slots.push({
      id: "",
      name: "",
      image_cloudinary_url: null,
      image_cloudinary_secure_url: null,
      image_cloudinary_public_id: null,
      image_width: null,
      image_height: null,
    });
  }

  return slots;
}

function getGunImageUrl(gun) {
  return gun.image_cloudinary_secure_url || gun.image_cloudinary_url || "";
}

export default function EditTopGuns({ currentTopGuns = [] }) {
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");
  const saveTimerRef = useRef(null);
  const fileInputRefs = useRef([]);
  const initialSlots = useMemo(
    () => createBlankSlots(currentTopGuns),
    [currentTopGuns],
  );
  const [guns, setGuns] = useState(initialSlots);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  function mergeSavedGuns(savedGuns = []) {
    setGuns(
      createBlankSlots(
        [...savedGuns].sort(
          (left, right) => left.display_order - right.display_order,
        ),
      ),
    );
  }

  function buildFormData(nextGuns) {
    const formData = new FormData();

    nextGuns.forEach((gun) => {
      formData.append("top_gun_ids", gun.id || "");
      formData.append("top_gun_names", gun.name || "");
    });

    return formData;
  }

  function saveGuns(nextGuns, debounce = false) {
    setGuns(nextGuns);
    setSaveMessage("Saving...");

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const runSave = () => {
      startTransition(async () => {
        const result = await updateTopGuns(
          initialState,
          buildFormData(nextGuns),
        );

        if (result?.success) {
          mergeSavedGuns(result.topGuns);
          setSaveMessage("Top guns saved.");
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
    setGuns((current) => {
      const next = [...current];
      next[index] = { ...next[index], name: value };
      return next;
    });
  }

  function saveCurrentGuns() {
    saveGuns(guns);
  }

  function clearGun(index) {
    const next = [...guns];
    next[index] = createBlankSlots([])[0];
    saveGuns(next);
  }

  function moveGun(index, direction) {
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= guns.length) {
      return;
    }

    const next = [...guns];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    saveGuns(next);
  }

  function updateGunInState(index, updatedGun) {
    setGuns((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...updatedGun };
      return next;
    });
  }

  async function handleImageChange(index, event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !guns[index]?.id) return;

    setUploadingIndex(index);
    setSaveMessage("Uploading image...");

    const formData = new FormData();
    formData.append("gun_id", guns[index].id);
    formData.append("image", file);

    const result = await updateTopGunImage(formData);

    if (result?.success) {
      updateGunInState(index, result.gun);
      setSaveMessage(result.message);
    } else {
      setSaveMessage(result?.message || "Could not upload top gun image.");
    }

    setUploadingIndex(null);
  }

  async function handleRemoveImage(index) {
    const gun = guns[index];
    if (!gun?.id || !getGunImageUrl(gun)) return;

    setUploadingIndex(index);
    setSaveMessage("Removing image...");

    const result = await removeTopGunImage(gun.id);

    if (result?.success) {
      updateGunInState(index, result.gun);
      setSaveMessage(result.message);
    } else {
      setSaveMessage(result?.message || "Could not remove top gun image.");
    }

    setUploadingIndex(null);
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
              isPending || uploadingIndex !== null ? "is-saving" : "is-saved"
            }`}
          >
            {saveMessage}
          </span>
        )}
      </div>

      <ol className="edit-top-guns__list">
        {guns.map((gun, index) => {
          const imageUrl = getGunImageUrl(gun);
          const isFirst = index === 0;
          const isLast = index === guns.length - 1;
          const isUploading = uploadingIndex === index;

          return (
            <li key={gun.id || `top-gun-${index}`} className="edit-top-guns__item">
              <span className="edit-top-guns__rank">{index + 1}</span>

              <div className="edit-top-guns__image">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt=""
                    width={52}
                    height={52}
                    className="edit-top-guns__image-photo"
                  />
                ) : (
                  <Crosshair size={25} strokeWidth={1.8} aria-hidden="true" />
                )}
              </div>

              <div className="edit-top-guns__details">
                <input
                  id={`top-gun-${index}`}
                  name="top_gun_names"
                  type="text"
                  value={gun.name}
                  onChange={(event) => updateGunName(index, event.target.value)}
                  onBlur={saveCurrentGuns}
                  maxLength={60}
                  placeholder="Add a favorite"
                />

                <div className="edit-top-guns__image-actions">
                  <button
                    type="button"
                    disabled={!gun.id || !gun.name || isUploading || isPending}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    <ImagePlus size={15} strokeWidth={2} aria-hidden="true" />
                    {imageUrl ? "Change image" : "Upload image"}
                  </button>

                  {imageUrl ? (
                    <button
                      type="button"
                      disabled={isUploading || isPending}
                      onClick={() => handleRemoveImage(index)}
                    >
                      <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                      Remove image
                    </button>
                  ) : null}

                  <input
                    ref={(node) => {
                      fileInputRefs.current[index] = node;
                    }}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => handleImageChange(index, event)}
                  />
                </div>
              </div>

              <div className="edit-top-guns__actions">
                <button
                  type="button"
                  disabled={isFirst || isPending || isUploading}
                  onClick={() => moveGun(index, "up")}
                  aria-label={`Move top gun ${index + 1} up`}
                >
                  ↑
                </button>

                <button
                  type="button"
                  disabled={isLast || isPending || isUploading}
                  onClick={() => moveGun(index, "down")}
                  aria-label={`Move top gun ${index + 1} down`}
                >
                  ↓
                </button>

                <button
                  type="button"
                  disabled={!gun.name || isPending || isUploading}
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

      <p className="edit-top-guns__hint">Changes save automatically.</p>
    </section>
  );
}
