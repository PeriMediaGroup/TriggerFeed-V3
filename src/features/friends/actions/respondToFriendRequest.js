// src/features/friends/actions/respondToFriendRequest.js

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function respondToFriendRequest(friendRequestId, response) {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return {
            success: false,
            message: "You must be logged in.",
        };
    }

    if (!["accepted", "declined"].includes(response)) {
        return {
            success: false,
            message: "Invalid response.",
        };
    }

    const { data: friendRow, error } = await supabase
        .from("friends")
        .update({
            status: response,
            updated_at: new Date().toISOString(),
        })
        .eq("id", friendRequestId)
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .select("id")
        .single();

    if (error) {
        console.error("RESPOND FRIEND REQUEST ERROR:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
        });

        return {
            success: false,
            message: "Could not update friend request.",
        };
    }

    if (response === "accepted") {
        const { error: notificationError } = await supabase.rpc(
            "create_friend_accepted_notification",
            {
                p_friend_id: friendRow.id,
            }
        );

        if (notificationError) {
            console.error("CREATE FRIEND ACCEPTED NOTIFICATION ERROR:", {
                code: notificationError.code,
                message: notificationError.message,
                details: notificationError.details,
                hint: notificationError.hint,
            });
        }
    }

    const now = new Date().toISOString();

    const { error: dismissNotificationError } = await supabase
        .from("notifications")
        .update({
            is_read: true,
            read_at: now,
            dismissed_at: now,
        })
        .eq("user_id", user.id)
        .eq("friend_id", friendRequestId)
        .eq("type", "friend_request")
        .is("dismissed_at", null);

    if (dismissNotificationError) {
        console.error("DISMISS FRIEND REQUEST NOTIFICATION ERROR:", {
            code: dismissNotificationError.code,
            message: dismissNotificationError.message,
            details: dismissNotificationError.details,
            hint: dismissNotificationError.hint,
        });
    }

    revalidatePath("/profile");
    revalidatePath("/profile/notifications");
    revalidatePath("/profile/friends");
    revalidatePath(`/profiles/${user.id}`);

    return {
        success: true,
        message: response === "accepted" ? "Friend request accepted." : "Friend request declined.",
    };
}