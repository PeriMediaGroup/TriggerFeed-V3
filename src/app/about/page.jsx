import {
  BadgeCheck,
  Check,
  Compass,
  Crosshair,
  ShieldCheck,
  X,
} from "lucide-react";

const beliefs = [
  {
    title: "Responsible Ownership",
    description: "Safe and responsible firearms ownership.",
    Icon: ShieldCheck,
  },
  {
    title: "Prepared, Not Paranoid",
    description: "Readiness without paranoia.",
    Icon: Compass,
  },
];

const triggerFeedIs = [
  "A focused community for responsible adults",
  "A place to share builds, range days, gear, and lessons learned",
  "Grounded in training, self-reliance, family, and freedom",
  "Built for practical knowledge and real conversation",
];

const triggerFeedIsNot = [
  "Facebook for guns",
  "A bloated social media circus with a camo paint job",
  "A substitute for training, judgment, or personal responsibility",
  "A place for illegal, threatening, or reckless behavior",
];

export default function AboutPage() {
  return (
    <main className="public-page about">
      <section className="public-page-hero" aria-labelledby="about-title">
        <div className="public-page-hero__content">
          <p className="public-page-hero__eyebrow">
            Train. Carry. Stay ready.
          </p>
          <h1 className="public-page-hero__title" id="about-title">
            About TriggerFeed
          </h1>
          <p className="public-page-hero__body about__intro">
            <BadgeCheck size={20} strokeWidth={2} aria-hidden="true" />
            <span> Real people. Real skills. Real community.</span>
          </p>
        </div>
      </section>

      <section className="about__community" aria-labelledby="about-community-title">
        <div className="about__section-heading">
          <p className="about__section-kicker">The community</p>
          <h2 id="about-community-title">More capable tomorrow.</h2>
          <p>
            We are proudly rooted in the Second Amendment and the firearms
            community. TriggerFeed is for responsible gun owners, everyday
            carriers, builders, hunters, trainers, veterans, first responders,
            and anyone who believes in being more capable tomorrow than they
            were yesterday.
          </p>

          <p>
            But readiness is bigger than firearms. It is training, planning,
            learning, building skills, protecting your family, and being
            prepared before life decides to get stupid, as it often does.
          </p>

          <p>
            Here, members can share builds, range days, gear, lessons learned,
            questions, projects, emergency readiness ideas, and practical
            knowledge without fighting the usual social media noise.
          </p>
        </div>
      </section>

      <section className="about__beliefs" aria-labelledby="about-beliefs-title">
        <div className="about__section-heading">
          <p className="about__section-kicker">What we believe</p>
          <h2 id="about-beliefs-title">Practical principles.</h2>
        </div>

        <div className="about__belief-grid">
          {beliefs.map(({ title, description, Icon }) => (
            <article key={title} className="about__belief-card">
              <div className="about__belief-icon">
                <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <p className="about__belief-note">
          Self-reliance, family, community, and freedom.
        </p>
      </section>

      <section
        className="about__identity"
        aria-labelledby="about-identity-title"
      >
        <div className="about__section-heading">
          <p className="about__section-kicker">The point</p>
          <h2 id="about-identity-title">Focused by design.</h2>
        </div>

        <div className="about__identity-grid">
          <article className="about__identity-card about__identity-card--is">
            <h3>TriggerFeed is</h3>
            <ul>
              {triggerFeedIs.map((item) => (
                <li key={item}>
                  <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="about__identity-card about__identity-card--not">
            <h3>TriggerFeed is not</h3>
            <ul>
              {triggerFeedIsNot.map((item) => (
                <li key={item}>
                  <X size={18} strokeWidth={2.2} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="about__closing">
        <Crosshair size={22} strokeWidth={1.7} aria-hidden="true" />
        <div>
          <h2>Train. Carry. Stay ready.</h2>
          <p>
            TriggerFeed is for adults who understand that rights and
            responsibility go together. We expect members to keep things legal,
            respectful, safe, and constructive.
          </p>
          <p>
            This is a place for real people, real skills, and real community.
          </p>
        </div>
      </section>
    </main>
  );
}
