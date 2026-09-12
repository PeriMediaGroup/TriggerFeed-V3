export async function getNotificationPostsById(supabase, notifications = []) {
  const postIds = [
    ...new Set(
      notifications
        .map(
          (notification) =>
            notification.post_id ||
            notification.metadata?.post_id ||
            notification.data?.post_id,
        )
        .filter(Boolean),
    ),
  ];

  if (!postIds.length) {
    return new Map();
  }

  let { data, error } = await supabase
    .from("posts")
    .select("id,slug,title,body")
    .in("id", postIds)
    .eq("is_deleted", false)
    .eq("visibility", "public");

  if (
    error?.code === "42703" &&
    `${error?.message || ""}`.includes("posts.slug")
  ) {
    console.warn(
      "POST SLUG COLUMN MISSING: retrying notification posts without slug.",
    );

    const fallbackResult = await supabase
      .from("posts")
      .select("id,title,body")
      .in("id", postIds)
      .eq("is_deleted", false)
      .eq("visibility", "public");

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    console.error("GET NOTIFICATION POSTS ERROR:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return new Map();
  }

  return new Map((data || []).map((post) => [post.id, post]));
}
