export const SIGNUP_INTENTS = ["events", "education", "both"];

export function normalizeSignupIntent(raw, fallback = "education") {
  const v = String(raw ?? "")
    .toLowerCase()
    .trim();
  if (SIGNUP_INTENTS.includes(v)) return v;
  if (["event", "host", "organizer", "ticketing"].includes(v)) return "events";
  if (["teach", "tutor", "course", "lms", "learning"].includes(v)) {
    return "education";
  }
  if (["all", "everything"].includes(v)) return "both";
  return fallback;
}

export function onboardingForIntent(intent) {
  const signup_intent = normalizeSignupIntent(intent, "education");
  return {
    signup_intent,
    skip_education_profile: signup_intent === "events",
    show_events: signup_intent === "events" || signup_intent === "both",
    show_education: signup_intent === "education" || signup_intent === "both",
    next_step: signup_intent === "events" ? "create_event" : "complete_profile",
  };
}
