import { getPosts } from "@/features/posts/data/getPosts";
import PostFeed from "@/features/posts/components/PostFeed";

export default async function ProfilePosts({ profile }) {
  if (!["creator", "organization"].includes(profile?.profile_type)) return null;
  const { posts, commentsByPostId, currentUserId, message } = await getPosts({ profileId: profile.id });
  return <section className="profile-content" aria-label="Profile content">
    <h2>{profile.profile_type === "organization" ? "Recent updates" : "Recent content"}</h2>
    {message ? <p role="status">{message}</p> : null}
    <PostFeed posts={posts} commentsByPostId={commentsByPostId} currentUserId={currentUserId} />
  </section>;
}
