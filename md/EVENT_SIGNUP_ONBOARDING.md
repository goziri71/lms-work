# Event vs education signup

Creators always get **events**. Education is the optional extra. There is no education-only path.

## Intent

Send on register (and optionally update later):

`signup_intent`: `events` | `both`

Alias: `intent`.

Legacy `education` is accepted and stored/returned as `both`.

| Intent | FE should |
|--------|-----------|
| `events` | Event product only. Name / email / password (org: org name). Skip education fields. After login go to **create event**. Hide LMS / courses. |
| `both` | Event **and** education. Show both nav items. Education onboarding (profile / qualifications) still applies. |

Default for new accounts (if omitted): `events`.

## Register

`POST /api/marketplace/register/sole-tutor`

Required: `email`, `password`, `fname`, `lname`  
Event only: `"signup_intent": "events"` (or omit — that is the default). Do **not** send qualifications / specialization.

Event + education: `"signup_intent": "both"`.

`POST /api/marketplace/register/organization`

Required: `name`, `email`, `password`  
Same `signup_intent` values. CAC/KYC later, not at signup.

Response includes:

```json
{
  "onboarding": {
    "signup_intent": "events",
    "skip_education_profile": true,
    "show_events": true,
    "show_education": false,
    "next_step": "create_event"
  }
}
```

`both` example:

```json
{
  "onboarding": {
    "signup_intent": "both",
    "skip_education_profile": false,
    "show_events": true,
    "show_education": true,
    "next_step": "complete_profile"
  }
}
```

Always use `show_events` / `show_education` / `skip_education_profile` from this object — do not hide Events in the sidebar.

If `skip_education_profile === true`, hide teacher questionnaire and LMS “create course” first-run.

## Login / profile

Same `onboarding` object is on:

- `POST /api/marketplace/login` (and sole-tutor / organization login)
- `GET /api/marketplace/tutor/profile`

Switch later: `PUT /api/marketplace/tutor/profile` `{ "signup_intent": "both" }` or `{ "signup_intent": "events" }`.

## Signup UI

Two choices only:

1. **Event**
2. **Event and education**

Do not show an education-only card.

## Migration

```bash
node scripts/migrate-add-signup-intent.js
node scripts/migrate-signup-intent-events-first.js
```

Existing `education` accounts become `both` so Events is visible.
