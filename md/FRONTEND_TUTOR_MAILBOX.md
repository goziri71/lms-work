# Frontend: Tutor connected mailbox (Gmail & Microsoft Outlook)

This document describes how to integrate the **tutor’s own email** (Gmail or Outlook) so they can **send**, **sync**, and **view threads** inside the app. This is **separate** from ZeptoMail (`POST /tutor/learners/email`), which sends from the platform domain.

**Base path:** `/api/marketplace`  
**Auth:** Tutor JWT — `Authorization: Bearer <access_token>` (same as other `/tutor/*` routes)

Replace `<API_ORIGIN>` with your API base, e.g. `https://lms-work.onrender.com`.

---

## Overview

| Provider | Connect (get URL) | OAuth callback (browser hits API) |
|----------|-------------------|-----------------------------------|
| **Gmail** | `GET .../tutor/mailbox/connect/gmail` | `GET .../tutor/mailbox/google/callback?code=...&state=...` |
| **Outlook** | `GET .../tutor/mailbox/connect/outlook` | `GET .../tutor/mailbox/microsoft/callback?code=...&state=...` |

Callbacks are handled by the **backend** (no Bearer token). The response is **JSON** (success or error). Plan UX accordingly: same-tab redirect (user briefly sees JSON unless you use a popup or a future redirect-to-frontend flow).

---

## 1. Connect Gmail

### Request

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox/connect/gmail
Authorization: Bearer <tutor_token>
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "<signed-jwt>"
  }
}
```

### Frontend steps

1. Call the endpoint with the tutor token.
2. Redirect the browser: `window.location.href = data.authorization_url`  
   (or open in a **popup**; Gmail often works best with full redirect.)
3. User signs in and consents on Google.
4. Google redirects to **`GOOGLE_MAILBOX_REDIRECT_URI`** on the API, e.g.  
   `https://<host>/api/marketplace/tutor/mailbox/google/callback?code=...&state=...`
5. API responds with JSON, e.g.:

```json
{
  "success": true,
  "message": "Gmail connected",
  "data": { "email": "tutor@gmail.com", "provider": "gmail" }
}
```

6. Poll or navigate to **`GET /tutor/mailbox`** to confirm the mailbox appears.

### Errors

- `401` — missing/invalid tutor token  
- `500` — OAuth not configured on server  

---

## 2. Connect Outlook (Microsoft)

### Request

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox/connect/outlook
Authorization: Bearer <tutor_token>
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "authorization_url": "https://login.microsoftonline.com/...",
    "state": "<signed-jwt>"
  }
}
```

### Frontend steps

Same pattern as Gmail: redirect user to `authorization_url`, user completes Microsoft login, browser lands on:

`GET /api/marketplace/tutor/mailbox/microsoft/callback?code=...&state=...`

Success example:

```json
{
  "success": true,
  "message": "Outlook connected",
  "data": { "email": "tutor@outlook.com", "provider": "outlook" }
}
```

### Backend env (ops)

Azure app must expose **`MICROSOFT_MAILBOX_REDIRECT_URI`** matching the callback URL above, with Graph delegated permissions (`Mail.Read`, `Mail.Send`, `User.Read`, `offline_access`).

---

## 3. List connected mailboxes

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox
Authorization: Bearer <tutor_token>
```

### Response `200`

```json
{
  "success": true,
  "data": {
    "mailboxes": [
      {
        "id": 1,
        "provider": "gmail",
        "email_address": "tutor@gmail.com",
        "last_sync_at": "2026-04-01T12:00:00.000Z",
        "connected_at": "2026-04-01T11:00:00.000Z"
      }
    ]
  }
}
```

`provider` is `"gmail"` or `"outlook"`.

---

## 4. Disconnect a mailbox

```http
DELETE <API_ORIGIN>/api/marketplace/tutor/mailbox/:id
Authorization: Bearer <tutor_token>
```

`:id` is the mailbox `id` from the list above.

---

## 5. Send email (Gmail or Outlook)

```http
POST <API_ORIGIN>/api/marketplace/tutor/mailbox/send
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

### Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mailbox_id` | number | Yes | From `GET /tutor/mailbox` |
| `to` | string | Yes | Primary recipient email |
| `subject` | string | Yes | |
| `body` | string | Yes | Plain text body |
| `cc` | string or string[] | No | |
| `bcc` | string or string[] | No | |
| `thread_id` | number | No | **App thread id** (not Gmail thread id). If set, sends as a **reply** in the same conversation |
| `student_id` | number | No | If set, must be an enrolled learner; links the thread to that learner |

### Response `200` (Gmail)

```json
{
  "success": true,
  "data": {
    "thread_id": 12,
    "provider_message_id": "..."
  }
}
```

### Response `200` (Outlook)

```json
{
  "success": true,
  "data": {
    "threadId": 12,
    "messageId": "..."
  }
}
```

(Shape may differ slightly; use `thread_id` / `threadId` to open the thread in UI.)

### Errors

- `400` — validation  
- `404` — mailbox or learner not found  
- `401` / `502` — token or provider failure  

---

## 6. Sync inbox (fetch new mail)

Call after connect or on a timer / pull-to-refresh.

```http
POST <API_ORIGIN>/api/marketplace/tutor/mailbox/sync
Authorization: Bearer <tutor_token>
Content-Type: application/json
```

```json
{ "mailbox_id": 1 }
```

### Response `200`

```json
{ "success": true, "message": "Sync completed" }
```

---

## 7. List threads

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox/threads?mailbox_id=1&page=1&limit=20
Authorization: Bearer <tutor_token>
```

- `mailbox_id` — optional filter  
- `page`, `limit` — pagination  

### Response `200`

```json
{
  "success": true,
  "data": {
    "threads": [ /* MailThread rows */ ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

## 8. Thread detail

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox/threads/:id
Authorization: Bearer <tutor_token>
```

---

## 9. Messages in a thread

```http
GET <API_ORIGIN>/api/marketplace/tutor/mailbox/threads/:id/messages
Authorization: Bearer <tutor_token>
```

Messages are ordered oldest → newest. Use `direction` (`sent` | `received`), `body_text`, `body_html`, `is_read`, etc., for UI.

---

## Suggested UI flow

1. **Settings → Email** — Show “Connect Gmail” / “Connect Outlook” if not connected; show connected addresses from `GET /tutor/mailbox`.
2. **Connect** — `GET connect/gmail` or `connect/outlook` → redirect to `authorization_url`.
3. After return, **refresh mailbox list** and optionally **sync** (`POST /tutor/mailbox/sync`).
4. **Inbox / threads** — `GET /tutor/mailbox/threads?mailbox_id=...`.
5. **Thread view** — `GET .../threads/:id/messages`.
6. **Compose / reply** — `POST /tutor/mailbox/send`; for reply include `thread_id` from your app’s thread list.
7. **Disconnect** — `DELETE /tutor/mailbox/:id`.

---

## Related: ZeptoMail (platform email)

Tutor → learner email **without** connecting Gmail:

- `POST /api/marketplace/tutor/learners/email`  
- See existing product docs for `student_id`, `subject`, `body`, `cc`, `bcc`.

---

## Troubleshooting (for users)

| Issue | Hint |
|-------|------|
| `redirect_uri_mismatch` | Redirect URI in Google/Azure must match server env exactly. |
| `invalid_grant` (Gmail) | Start connect again; don’t refresh the callback URL twice. |
| Outlook login fails | Check Azure app permissions, redirect URI, and client secret. |
| Empty threads | Run **sync**; Gmail/Outlook must finish first sync. |

---

*Last updated to match backend routes under `src/routes/marketplace.js` and `src/controllers/marketplace/tutorMailbox.js`.*
