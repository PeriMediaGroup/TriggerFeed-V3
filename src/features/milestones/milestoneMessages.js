export const MILESTONE_MESSAGES = {
  birthday: [
    {
      title: "Happy Birthday from TriggerFeed 🎉",
      body: "Hope you have an awesome day, {name}. Try not to spend all of it explaining your gear choices.",
    },
    {
      title: "Birthday protocol activated",
      body: "Have a great one, {name}. The feed can survive without you for at least a few minutes.",
    },
    {
      title: "Another lap completed",
      body: "Happy birthday, {name}. Solid work continuing to exist with this much style.",
    },
    {
      title: "TriggerFeed birthday notice",
      body: "Hope your day is excellent, {name}. Consider this your official excuse to enjoy it.",
    },
  ],
  accountAnniversary: [
    {
      title: "TriggerFeed anniversary unlocked",
      body: "{name}, you have been here for {years} {yearPlural}. That is basically tenure in internet time.",
    },
    {
      title: "Account milestone check-in",
      body: "{years} {yearPlural} on TriggerFeed, {name}. Somehow, the servers held.",
    },
    {
      title: "Still here, still posting",
      body: "Happy TriggerFeed anniversary, {name}. {years} {yearPlural} in and your scroll thumb deserves respect.",
    },
  ],
  rank: [
    {
      title: "Rank update: {rankName}",
      body: "Nice work, {name}. The system has noticed, which is slightly less dramatic than a parade but more useful.",
    },
    {
      title: "{rankName} achieved",
      body: "Look at you, {name}. New rank, same feed, marginally increased bragging rights.",
    },
    {
      title: "Milestone reached",
      body: "{name}, you hit {rankName}. Please use this power responsibly, or at least entertainingly.",
    },
  ],
};

export function getMilestoneMessages(milestoneType) {
  return MILESTONE_MESSAGES[milestoneType] || [];
}

export function formatMilestoneMessage(template, replacements = {}) {
  return String(template || "").replace(
    /\{(name|years|yearPlural|rankName)\}/g,
    (_match, key) => replacements[key] ?? "",
  );
}
