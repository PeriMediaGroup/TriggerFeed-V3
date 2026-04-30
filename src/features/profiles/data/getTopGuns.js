// src/features/profiles/data/getTopGuns.js

import { createClient } from "@/lib/supabase/server";

export async function getTopGuns(userId) {
    const supabase = await createClient();

    const { data: topGunRows, error: topGunsError } = await supabase
        .from("profile_top_guns")
        .select("id, gun_id, display_order")
        .eq("user_id", userId)
        .order("display_order", { ascending: true })
        .limit(4);

    if (topGunsError) {
        console.error("GET TOP GUN ROWS ERROR:", topGunsError);

        return {
            topGuns: [],
            error: topGunsError,
        };
    }

    const safeRows = topGunRows || [];

    if (!safeRows.length) {
        return {
            topGuns: [],
            error: null,
        };
    }

    const gunIds = safeRows
        .map((row) => row.gun_id)
        .filter(Boolean);

    if (!gunIds.length) {
        return {
            topGuns: [],
            error: null,
        };
    }

    const { data: guns, error: gunsError } = await supabase
        .from("guns")
        .select(
            `
      id,
      manufacturer,
      model,
      nickname,
      caliber,
      image_url,
      visibility
    `
        )
        .in("id", gunIds);

    if (topGunsError) {
        console.error("GET TOP GUN ROWS ERROR:", {
            code: topGunsError.code,
            message: topGunsError.message,
            details: topGunsError.details,
            hint: topGunsError.hint,
        });

        return {
            topGuns: [],
            error: topGunsError,
        };
    }

    const gunMap = new Map((guns || []).map((gun) => [gun.id, gun]));

    const topGuns = safeRows
        .map((row) => ({
            id: row.id,
            display_order: row.display_order,
            gun: gunMap.get(row.gun_id) || null,
        }))
        .filter((item) => item.gun);

    return {
        topGuns,
        error: null,
    };
}