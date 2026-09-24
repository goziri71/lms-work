export const SIGNUP_INTENTS = ["events", "both"];
export const DEFAULT_SIGNUP_INTENT = "events";

const EVENT_ALIASES = ["events", "event", "host", "organizer", "ticketing"];
const BOTH_ALIASES = [
  "both",
  "all",
  "everything",
  // Legacy education-only is now events + education so events stay visible
  "education",
  "teach",
  "tutor",
  "course",
  "lms",
  "learning",
];

function mapIntent(raw) {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (EVENT_ALIASES.includes(v)) return "events";
  if (BOTH_ALIASES.includes(v)) return "both";
  return null;
}

export function normalizeSignupIntent(raw, fallback = DEFAULT_SIGNUP_INTENT) {
  return mapIntent(raw) || mapIntent(fallback) || DEFAULT_SIGNUP_INTENT;
}

export function onboardingForIntent(intent) {
  const signup_intent = normalizeSignupIntent(intent);
  const eventOnly = signup_intent === "events";
  return {
    signup_intent,
    skip_education_profile: eventOnly,
    show_events: true,
    show_education: !eventOnly,
    next_step: eventOnly ? "create_event" : "complete_profile",
  };
}
