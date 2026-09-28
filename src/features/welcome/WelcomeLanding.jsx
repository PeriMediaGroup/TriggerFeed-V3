import Link from "next/link";
import WelcomeShowcase from "./WelcomeShowcase";
import {
  ArrowRight,
  Crosshair,
  Users,
  Video,
  Building2,
  Check,
  ShieldCheck,
} from "lucide-react";

const audiences = [
  {
    key: "member",
    label: "Members",
    number: "01",
    Icon: Users,
    headline: "Find your people.",
    description:
      "For gun owners, everyday carriers, hunters, collectors, builders, and anyone who enjoys a good day at the range.",
    benefits: [
      "Share posts, photos, and videos.",
      "Talk firearms, gear, training, competition, and preparedness.",
      "Connect with members and follow creators and organizations.",
    ],
    cta: "Join TriggerFeed",
  },
  {
    key: "creator",
    label: "Creators",
    number: "02",
    Icon: Video,
    headline: "Bring your expertise.",
    description:
      "For instructors, competitive shooters, YouTubers, trainers, gunsmiths, and voices across the firearms community.",
    benefits: [
      "A dedicated Creator profile with your identity and category.",
      "Connect your website, channels, and social platforms.",
      "Build a following among people interested in what you share.",
    ],
    cta: "Create a Creator Account",
  },
  {
    key: "organization",
    label: "Organizations",
    number: "03",
    Icon: Building2,
    headline: "Be part of the conversation.",
    description:
      "For manufacturers, retailers, gun stores, ranges, training companies, clubs, and industry organizations.",
    benefits: [
      "A dedicated Organization profile for your official presence.",
      "Share your website, social links, and contact information.",
      "Publish news, products, events, and updates. Connect directly with members.",
    ],
    cta: "Create an Organization Account",
  },
];

export default function WelcomeLanding({ links, isAuthenticated = false }) {
  const Page = isAuthenticated ? "div" : "main";
  return (
    <Page className="welcome" aria-labelledby="welcome-title">
      <section className="welcome__hero">
        <div className="welcome__hero-copy">
          <p className="welcome__eyebrow">Welcome to TriggerFeed</p>
          <h1 id="welcome-title">
            Train. Carry.
            <br />
            <span>Stay Ready.</span>
          </h1>
          <p className="welcome__lead">
            Your interests. Your people. Your community.
          </p>
          <p className="welcome__intro">
            A social community built for gun owners, shooters, trainers,
            creators, manufacturers, ranges, retailers, and organizations.
          </p>
          <p className="welcome__intro">
            Share what you shoot. Learn from other members. Follow the people
            and organizations you care about.
          </p>
          <div className="welcome__actions">
            <Link
              className="welcome__button welcome__button--primary"
              href={isAuthenticated ? "/" : links.member}
            >
              {isAuthenticated ? "Go to Your Feed" : "Join TriggerFeed"}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            {!isAuthenticated && (
              <Link className="welcome__button" href={links.login}>
                Sign In
              </Link>
            )}
          </div>
          <p className="welcome__note">
            Free to join. Built for responsible adults, 18 and older.
          </p>
        </div>
        <div className="welcome__brand-panel" aria-hidden="true">
          <span className="welcome__brand-caption">A community with focus</span>
          <div className="welcome__target">
            <Crosshair strokeWidth={0.6} />
          </div>
          <span className="welcome__brand-word">TriggerFeed</span>
          <span className="welcome__brand-caption">
            Firearms. Training. Preparedness.
          </span>
        </div>
      </section>

      <nav className="welcome__jump-links" aria-label="Explore TriggerFeed">
        <span>Find your place</span>
        <Link href="#welcome-members">Members</Link>
        <Link href="#welcome-creators">Creators</Link>
        <Link href="#welcome-organizations">Organizations</Link>
      </nav>

      <section
        className="welcome__section"
        aria-labelledby="welcome-community-title"
      >
        <div className="welcome__section-heading">
          <p className="welcome__eyebrow">
            One community. Three ways to belong.
          </p>
          <h2 id="welcome-community-title">There’s a place for you here.</h2>
          <p>
            Whether you’re here to learn, share your expertise, or represent
            your organization, start with the account that fits you.
          </p>
        </div>
        <div className="welcome__audiences">
          {audiences.map(
            ({
              key,
              label,
              number,
              Icon,
              headline,
              description,
              benefits,
              cta,
            }) => (
              <article
                className="welcome__audience"
                key={key}
                id={`welcome-${label.toLowerCase()}`}
              >
                <div className="welcome__card-top">
                  <Icon size={26} aria-hidden="true" />
                  <span>{number}</span>
                </div>
                <p className="welcome__eyebrow">{label}</p>
                <h3>{headline}</h3>
                <p>{description}</p>
                <ul>
                  {benefits.map((benefit) => (
                    <li key={benefit}>
                      <Check size={17} aria-hidden="true" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                {key !== "member" && (
                  <p className="welcome__verification">
                    Verification is available where applicable; creating an
                    account does not automatically grant verification.
                  </p>
                )}
                <Link
                  href={links[key]}
                  className={`welcome__button${key === "member" ? " welcome__button--primary" : ""}`}
                >
                  {cta}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>
            ),
          )}
        </div>
      </section>

      <section
        className="welcome__purpose"
        aria-labelledby="welcome-purpose-title"
      >
        <Crosshair size={34} aria-hidden="true" />
        <div>
          <p className="welcome__eyebrow">Focused by design</p>
          <h2 id="welcome-purpose-title">
            Here, these interests are the point.
          </h2>
          <p>
            TriggerFeed isn’t trying to replace every social network. We’re
            building a focused community around firearms, training,
            preparedness, and the people and businesses that make it all happen.
          </p>
          <p>
            Bring your questions. Share what you know. Find people who
            understand why it matters to you.
          </p>
          <Link className="welcome__text-link" href="/about">
            More about TriggerFeed <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        className="welcome__section"
        aria-labelledby="welcome-preview-title"
      >
        <div className="welcome__section-heading">
          <p className="welcome__eyebrow">Inside TriggerFeed</p>
          <h2 id="welcome-preview-title">
            A place to share. A reason to return.
          </h2>
          <p>A closer look at what you can do when you join.</p>
        </div>
        <WelcomeShowcase />
      </section>

      <section
        className="welcome__closing"
        aria-labelledby="welcome-closing-title"
      >
        <ShieldCheck size={28} aria-hidden="true" />
        <p className="welcome__eyebrow">Make yourself at home</p>
        <h2 id="welcome-closing-title">Ready to join TriggerFeed?</h2>
        <p>Membership is free. Your next conversation starts here.</p>
        <div className="welcome__actions">
          <Link
            className="welcome__button welcome__button--primary"
            href={isAuthenticated ? "/" : links.member}
          >
            {isAuthenticated ? "Go to Your Feed" : "Create Your Account"}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="welcome__button" href={links.creator}>
            Creator Account
          </Link>
          <Link className="welcome__button" href={links.organization}>
            Organization Account
          </Link>
        </div>
        {!isAuthenticated && (
          <Link className="welcome__text-link" href={links.login}>
            Already a member? Sign in
          </Link>
        )}
        <p className="welcome__note">
          An 18+ community. Date of birth and agreement to our{" "}
          <Link href="/legal#terms">terms</Link> are required at signup.
        </p>
      </section>
    </Page>
  );
}
