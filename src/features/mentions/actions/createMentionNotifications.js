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

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const notifiedUserIds = [];

  for (const profile of uniqueProfiles) {
    const { error } = await supabase.rpc("create_mention_notification", {
      p_user_id: profile.id,
      p_post_id: postId,
      p_comment_id: commentId,
    });

    // 23505 = duplicate key violation.
    // This can happen if the same mention notification already exists.
    if (error && error.code !== "23505") {
      return {
        success: false,
        notifiedUserIds: [],
        error,
      };
    }

    notifiedUserIds.push(profile.id);
  }

  return {
    success: true,
    notifiedUserIds,
    error: null,
  };
}