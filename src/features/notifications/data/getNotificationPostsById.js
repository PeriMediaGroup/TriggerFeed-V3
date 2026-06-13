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

  const { data, error } = await supabase
    .from("posts")
    .select("id,title,body")
    .in("id", postIds)
    .eq("is_deleted", false)
    .eq("visibility", "public");

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
