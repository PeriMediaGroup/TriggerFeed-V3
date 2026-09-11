import { cache } from "react";
import { permanentRedirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getPostByIdentifier } from "@/features/posts/data/getPostById";

import PostDetail from "@/features/posts/components/PostDetail";

import { getCommentsByPostId } from "@/features/comments/queries";
import CommentForm from "@/features/comments/components/CommentForm";
import CommentList from "@/features/comments/components/CommentList";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  getAbsolutePostUrl,
  getPostPath,
  isUuid,
} from "@/features/posts/lib/postUrls";
import {
  getFirstPostImage,
  getPostDescription,
  getPostJsonLd,
  isIndexablePost,
  normalizeSeoText,
  stringifyJsonLd,
} from "@/features/posts/lib/postSeo";

const getPostForRoute = cache(getPostByIdentifier);

export async function generateMetadata({ params }) {
  const { postId } = await params;
  const { post } = await getPostForRoute(postId);

  if (!post || !isIndexablePost(post)) {
    return {
      title: "Post not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = normalizeSeoText(post.title);
  const description = getPostDescription(post);
  const canonicalUrl = getAbsolutePostUrl(post, SITE_URL);
  const image = getFirstPostImage(post);
  const images = image ? [{ url: image, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: post.created_at || undefined,
      modifiedTime: post.updated_at || undefined,
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostDetailPage({ params }) {
  const { postId } = await params;

  const user = await getCurrentUser();
  const { post, error } = await getPostForRoute(postId);

  if (error || !post) {
    notFound();
  }

  if (isUuid(postId) && post.slug) {
    permanentRedirect(getPostPath(post));
  }

  const { comments, error: commentsError } = await getCommentsByPostId(post.id);
  const jsonLd = getPostJsonLd(post);

  return (
    <main className="post-detail-page">
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
        />
      ) : null}

      <PostDetail post={post} currentUserId={user?.id || null} />

      <section className="post-detail__comments">
        <CommentForm postId={post.id} isLoggedIn={Boolean(user)} />

        {commentsError && (
          <p className="post-detail__comments-error">
            Could not load comments: {commentsError}
          </p>
        )}

        <CommentList
          comments={comments}
          currentUserId={user?.id || null}
          postId={post.id}
        />
      </section>
    </main>
  );
}
