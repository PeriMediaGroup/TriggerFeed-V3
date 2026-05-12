import { parseMentionUsernames } from "../utils/parseMentions";
import { getMentionedProfiles } from "./getMentionedProfiles";

export async function getMentionProfilesForText(text = "") {
  const usernames = parseMentionUsernames(text);

  if (usernames.length === 0) {
    return [];
  }

  const { profiles, error } = await getMentionedProfiles(usernames);

  if (error) {
    console.error("GET MENTION PROFILES ERROR:", error);
    return [];
  }

  return profiles;
}