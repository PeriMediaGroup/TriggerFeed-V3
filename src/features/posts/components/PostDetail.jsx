import Link from "next/link";
import Image from "next/image";
import PostActions from "@/features/posts/components/PostActions";
import SmartText from "@/components/ui/SmartText";

export default function PostDetail({ post, currentUser }) {
  const authorName =
    post.author?.username || post.author?.first_name || "Unknown user";

  const authorId = post.user_id || post.author?.id;
  const isOwner = currentUser?.id === post.user_id;

  return (
    <article className="post-detail">
      <header className="post-detail__header">
        <p>
          Posted by{" "}
          {authorId ? (
            <Link href={`/profiles/${authorId}`}>
              <strong>{authorName}</strong>
            </Link>
          ) : (
            <strong>{authorName}</strong>
          )}
        </p>

        <h1 className="post-detail__title">{post.title}</h1>
        <p><SmartText text={post.body} /></p>

        <PostActions postId={post.id} isOwner={isOwner} />
      </header>

      {post.description && (
        <p className="post-detail__description">{post.description}</p>
      )}

      {post.image_url && (
        <Image
          className="post-detail__image"
          src={post.image_url}
          alt={post.title || "Post image"}
          width={800}
          height={600}
        />
      )}
    </article>
  );
}