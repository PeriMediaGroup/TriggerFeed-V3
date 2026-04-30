// src/features/profiles/data/getTopFriends.js

import { createClient } from "@/lib/supabase/server";

export async function getTopFriends(userId) {
    const supabase = await createClient();

    const { data: topFriendRows, error: topFriendsError } = await supabase
        .from("profile_top_friends")
        .select("id, friend_user_id, display_order")
        .eq("user_id", userId)
        .order("display_order", { ascending: true })
        .limit(4);

    if (topFriendsError) {
        console.error("GET TOP FRIEND ROWS ERROR:", topFriendsError);

        return {
            topFriends: [],
            error: topFriendsError,
        };
    }

    const safeRows = topFriendRows || [];

    if (!safeRows.length) {
        return {
            topFriends: [],
            error: null,
        };
    }

    const friendIds = safeRows
        .map((row) => row.friend_user_id)
        .filter(Boolean);

    if (!friendIds.length) {
        return {
            topFriends: [],
            error: null,
        };
    }

    const { data: friends, error: friendsError } = await supabase
        .from("profiles")
        .select(
            `
      id,
      username,
      display_name,
      first_name,
      last_name,
      avatar_cloudinary_url
    `
        )
        .in("id", friendIds)
        .eq("is_deleted", false);

    if (topFriendsError) {
        console.error("GET TOP FRIEND ROWS ERROR:", {
            code: topFriendsError.code,
            message: topFriendsError.message,
            details: topFriendsError.details,
            hint: topFriendsError.hint,
        });

        return {
            topFriends: [],
            error: topFriendsError,
        };
    }

    const friendMap = new Map((friends || []).map((friend) => [friend.id, friend]));

    const topFriends = safeRows
        .map((row) => ({
            id: row.id,
            display_order: row.display_order,
            friend: friendMap.get(row.friend_user_id) || null,
        }))
        .filter((item) => item.friend);

    return {
        topFriends,
        error: null,
    };
}