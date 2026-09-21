export const SIGNUP_PROFILE_TYPES = {
  member: {
    eyebrow: "Join TriggerFeed",
    title: "Create your account",
    intro: "Join the conversation and build your TriggerFeed profile.",
  },
  creator: {
    eyebrow: "Creator signup",
    title: "Create your Creator profile",
    intro:
      "Create your TriggerFeed account, share what you make, and set up your public Creator profile. Verification is reviewed separately.",
    displayNameLabel: "Creator, display, or channel name",
    categoryLabel: "Creator category",
    categoryPlaceholder: "Choose a category",
    categories: [
      "Firearms Reviews", "Training", "Hunting", "Gear", "Podcast",
      "Industry", "Outdoor", "Other",
    ],
    subtypeLabel: "Primary platform",
    subtypePlaceholder: "YouTube, podcast, newsletter, etc.",
    bioLabel: "Short creator bio",
    locationLabel: "Location (optional)",
  },
  organization: {
    eyebrow: "Organization signup",
    title: "Create an organization profile",
    intro:
      "Create the account that will manage your organization and set up its public TriggerFeed profile. Verification is reviewed separately.",
    displayNameLabel: "Organization name",
    categoryLabel: "Organization type",
    categoryPlaceholder: "Choose an organization type",
    categories: [
      "Training Facility", "Range", "Manufacturer", "Retailer", "Gun Shop",
      "Media", "Club", "Nonprofit", "Event Organizer", "Other",
    ],
    subtypeLabel: "Account manager (optional)",
    subtypePlaceholder: "Name of the person managing this account",
    bioLabel: "Short organization description",
    locationLabel: "City and state (optional)",
  },
};

export const SPECIALIZED_PROFILE_TYPES = ["creator", "organization"];
