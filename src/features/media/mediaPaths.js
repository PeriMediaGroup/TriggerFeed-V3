export function getPostMediaFolder({ userId, postId }) {
  if (!userId || !postId) {
    throw new Error("Missing userId or postId for post media folder");
  }

  return `triggerfeed/posts/${userId}/${postId}`;
}