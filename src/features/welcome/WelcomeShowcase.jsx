"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Maximize2 } from "lucide-react";

const WelcomeLightbox = dynamic(() => import("./WelcomeLightbox"), {
  ssr: false,
});

const screenshots = [
  {
    id: "feed",
    title: "The TriggerFeed Feed",
    description:
      "Follow the community, friends, creators, and organizations you care about.",
    src: "/images/welcome/triggerfeed-feed-desktop.png",
    width: 1371,
    height: 922,
    alt: "TriggerFeed desktop feed with Main, Friends, Following and Trending tabs, community posts and navigation.",
  },
  {
    id: "profile",
    title: "Your TriggerFeed Profile",
    description: "Make it yours with posts, friends, badges, ranks, and more.",
    src: "/images/welcome/triggerfeed-profile-desktop.png",
    width: 1379,
    height: 922,
    alt: "TriggerFeed profile with a cover photo, avatar, biography, Founding Member badge, post and friend counts, and rank.",
  },
  {
    id: "mobile",
    title: "TriggerFeed on Mobile",
    description: "The same community wherever you are.",
    src: "/images/welcome/triggerfeed-feed-mobile.png",
    width: 395,
    height: 841,
    alt: "TriggerFeed mobile feed showing community posts, feed tabs and bottom navigation.",
  },
  {
    id: "create",
    title: "Create & Share",
    description: "Post updates, photos, video, GIFs, polls, and more.",
    src: "/images/welcome/triggerfeed-create-post-mobile.png",
    width: 384,
    height: 835,
    alt: "TriggerFeed mobile Create Post screen with headline, rich text editor, photo and video, emoji, GIF and poll controls.",
  },
];

export default function WelcomeShowcase() {
  const [index, setIndex] = useState(-1);
  return (
    <>
      <div className="welcome-showcase">
        {screenshots.map((screenshot, position) => (
          <figure
            className={`welcome-showcase__item welcome-showcase__item--${screenshot.id}`}
            key={screenshot.id}
          >
            <button
              type="button"
              className="welcome-showcase__open"
              aria-label={`View larger: ${screenshot.title}`}
              aria-haspopup="dialog"
              onClick={() => setIndex(position)}
            >
              <Image
                src={screenshot.src}
                width={screenshot.width}
                height={screenshot.height}
                alt={screenshot.alt}
                className="welcome-showcase__image"
                loading="lazy"
                unoptimized
              />
              <span className="welcome-showcase__affordance">
                <Maximize2 size={16} aria-hidden="true" />
                View larger
              </span>
            </button>
            <figcaption className="welcome-showcase__caption">
              <h3>{screenshot.title}</h3>
              <p>{screenshot.description}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {index >= 0 && (
        <WelcomeLightbox
          index={index}
          slides={screenshots}
          close={() => setIndex(-1)}
        />
      )}
    </>
  );
}
