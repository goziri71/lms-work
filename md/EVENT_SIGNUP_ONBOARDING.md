# Event vs education signup

Creators who only want **event tickets** should not see education onboarding (qualifications, specialization, years of experience, course setup).

## Intent

Send on register (and optionally update later):

`signup_intent`: `events` | `education` | `both`

Alias: `intent`.

| Intent | FE should |
|--------|-----------|
| `events` | Name / email / password (org: org name). Skip education fields. After login go to **create event**. |
| `education` | Current tutor onboarding (default for existing accounts). |
| `both` | Show both event and education features. |

## Register

`POST /api/marketplace/register/sole-tutor`

Required: `email`, `password`, `fname`, `lname`  
For events also send `"signup_intent": "events"`. Do **not** send qualifications / specialization.

`POST /api/marketplace/register/organization`

Required: `name`, `email`, `password`  
For events: `"signup_intent": "events"`. CAC/KYC later, not at signup.

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

If `skip_education_profile === true`, hide teacher questionnaire and LMS “create course” first-run.

## Login / profile

Same `onboarding` object is on:

- `POST /api/marketplace/login` (and sole-tutor / organization login)
- `GET /api/marketplace/tutor/profile`

Change later: `PUT /api/marketplace/tutor/profile` `{ "signup_intent": "both" }`

## Migration

```bash
node scripts/migrate-add-signup-intent.js
```

Existing accounts default to `education`.
