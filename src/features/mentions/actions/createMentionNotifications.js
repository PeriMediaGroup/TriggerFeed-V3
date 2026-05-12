import { parseMentionUsernames } from "../utils/parseMentions";
import { getMentionedProfiles } from "../data/getMentionedProfiles";

export async function createMentionNotifications({
  text,
  actorId,
  postId,
  commentId = null,
}) {
  if (!text || !actorId || !postId) {
    return {
      success: true,
      notifiedUserIds: [],
      error: null,
    };
  }

  const usernames = parseMentionUsernames(text);

  if (usernames.length === 0) {
    return {
      success: true,
      notifiedUserIds: [],
      error: null,
    };
  }

  const { profiles, error: profileError } = await getMentionedProfiles(usernames);

  if (profileError) {
    return {
      success: false,
      notifiedUserIds: [],
      error: profileError,
    };
  }

  const mentionedProfiles = profiles.filter((profile) => profile.id !== actorId);

  if (mentionedProfiles.length === 0) {
    return {
      success: true,
      notifiedUserIds: [],
      error: null,
    };
  }

  const uniqueProfiles = Array.from(
    new Map(mentionedProfiles.map((profile) => [profile.id, profile])).values()
  );

  const rows = uniqueProfiles.map((profile) => ({
    user_id: profile.id,
    actor_id: actorId,
    type: "mention",
    post_id: postId,
    comment_id: commentId,
    is_read: false,
    metadata: {
      source: commentId ? "comment" : "post",
    },
  }));

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { error } = await supabase.from("notifications").insert(rows);

  // 23505 = duplicate key violation.
  // This can happen if the same mention notification already exists.
  if (error && error.code !== "23505") {
    return {
      success: false,
      notifiedUserIds: [],
      error,
    };
  }

  return {
    success: true,
    notifiedUserIds: uniqueProfiles.map((profile) => profile.id),
    error: null,
  };
}