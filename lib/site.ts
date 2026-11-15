// The App's own details, in one place.
//
// PLACEHOLDER: the product name isn't chosen yet (plan.md gate M6). It renders
// with a visible "Placeholder" tag wherever it's the headline, so nobody takes
// it for the real name. Change it here once M6 is done.

export const site = {
  name: "Lawn Care App",
  namePlaceholder: true,

  tagline: "Finish the job. The books are done.",
  blurb:
    "The business system for solo lawn-care operators: every job you finish lands on the client's invoice by itself, so the bookkeeping is done before you leave the property.",

  /** The browser bar and phone theme color: the brand's forest green. */
  themeColor: "#2B4A34",
} as const;

/**
 * The menu. Empty until the marketing pages exist (plan.md Step 20): a link is
 * added here only when its page is real, so the menu never points at nothing.
 */
export const navLinks: { href: string; label: string }[] = [];
