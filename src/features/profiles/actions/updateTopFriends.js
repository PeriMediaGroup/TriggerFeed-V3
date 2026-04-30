// src/features/profiles/actions/updateTopFriends.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateTopFriends(_prevState, formData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "You must be logged in.",
      errors: {},
    };
  }

  const selectedFriendIds = formData
    .getAll("top_friend_ids")
    .map((id) => String(id).trim())
    .filter(Boolean);

  const uniqueFriendIds = [...new Set(selectedFriendIds)].slice(0, 4);

  if (selectedFriendIds.length > 4) {
    return {
      success: false,
      message: "You can only choose up to 4 top friends.",
      errors: {},
    };
  }

  if (!uniqueFriendIds.length) {
    const { error: deleteError } = await supabase
      .from("profile_top_friends")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("CLEAR TOP FRIENDS ERROR:", {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
      });

      return {
        success: false,
        message: "Could not clear top friends.",
        errors: {},
      };
    }

    revalidatePath("/profile");
    revalidatePath(`/profiles/${user.id}`);
    revalidatePath("/profile/friends");

    return {
      success: true,
      message: "Top friends cleared.",
      errors: {},
    };
  }

  // Server-side safety check: only accepted friends can be selected.
  const { data: acceptedRows, error: acceptedError } = await supabase
    .from("friends")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq("status", "accepted");

  if (acceptedError) {
    console.error("VERIFY TOP FRIENDS ERROR:", {
      code: acceptedError.code,
      message: acceptedError.message,
      details: acceptedError.details,
      hint: acceptedError.hint,
    });

    return {
      success: false,
      message: "Could not verify friends.",
      errors: {},
    };
  }

  const acceptedFriendIds = new Set(
    (acceptedRows || [])
      .map((row) =>
        row.requester_id === user.id ? row.addressee_id : row.requester_id
      )
      .filter(Boolean)
  );

  const invalidFriendIds = uniqueFriendIds.filter(
    (friendId) => !acceptedFriendIds.has(friendId)
  );

  if (invalidFriendIds.length) {
    return {
      success: false,
      message: "Top friends can only include accepted friends.",
      errors: {},
    };
  }

  const rowsToInsert = uniqueFriendIds.map((friendUserId, index) => ({
    user_id: user.id,
    friend_user_id: friendUserId,
    display_order: index,
  }));

  const { error: deleteError } = await supabase
    .from("profile_top_friends")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("DELETE TOP FRIENDS ERROR:", {
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });

    return {
      success: false,
      message: "Could not update top friends.",
      errors: {},
    };
  }

  const { error: insertError } = await supabase
    .from("profile_top_friends")
    .insert(rowsToInsert);

  if (insertError) {
    console.error("INSERT TOP FRIENDS ERROR:", {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });

    return {
      success: false,
      message: "Could not save top friends.",
      errors: {},
    };
  }

  revalidatePath("/profile");
  revalidatePath(`/profiles/${user.id}`);
  revalidatePath("/profile/friends");

  return {
    success: true,
    message: "Top friends updated.",
    errors: {},
  };
}