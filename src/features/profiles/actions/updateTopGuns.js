// src/features/profiles/actions/updateTopGuns.js

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateTopGuns(_prevState, formData) {
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

    const gunNames = formData
        .getAll("top_gun_names")
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .slice(0, 4);

    const errors = {};

    const invalidName = gunNames.find((name) => name.length > 60);

    if (invalidName) {
        errors.top_guns = "Each top gun name must be 60 characters or less.";
    }

    if (Object.keys(errors).length > 0) {
        return {
            success: false,
            message: "Please fix the fields below.",
            errors,
        };
    }

    const rowsToInsert = gunNames.map((name, index) => ({
        user_id: user.id,
        name,
        display_order: index,
        updated_at: new Date().toISOString(),
    }));

    const { error: deleteError } = await supabase
        .from("profile_top_guns")
        .delete()
        .eq("user_id", user.id);

    if (deleteError) {
        console.error("DELETE TOP GUNS ERROR:", {
            code: deleteError.code,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
        });

        return {
            success: false,
            message: "Could not update top guns.",
            errors: {},
        };
    }

    if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
            .from("profile_top_guns")
            .insert(rowsToInsert);

        if (insertError) {
            console.error("INSERT TOP GUNS ERROR:", {
                code: insertError.code,
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
            });

            return {
                success: false,
                message: "Could not save top guns.",
                errors: {},
            };
        }
    }
    
    return {
        success: true,
        message: "Top guns saved.",
        errors: {},
    };

    redirect("/profile?tab=guns");
}
