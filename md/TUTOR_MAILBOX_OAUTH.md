# Tutor mailbox OAuth (Gmail / Outlook)

## After login: browser shows JSON instead of your app

The OAuth **callback** hits your **API** (`/api/marketplace/tutor/mailbox/google/callback`). The server **redirects** to the **frontend** with query parameters (it does not return JSON in the browser).

Set **`FRONTEND_URL`** in `.env` / Render to your real app origin (e.g. `https://app.knomada.co`). Optionally set **`MAILBOX_OAUTH_RETURN_PATH`** (default **`/settings/mailbox`**) to the route that should open after connect.

**Success redirect example**

`{FRONTEND_URL}{MAILBOX_OAUTH_RETURN_PATH}?mailbox_connected=gmail&email=user@gmail.com`

**Failure redirect example**

`...?mailbox_error=1&reason=...`

The frontend should read these query params and show a toast or mailbox settings UI (and strip params from the URL).

---

## Error: `redirect_uri_mismatch` (Google)

Google only allows redirects that are **exactly** listed on the OAuth client. The app sends this redirect URI (unless you override it):

```
{PUBLIC_API_URL or APP_URL}/api/marketplace/tutor/mailbox/google/callback
```

**Example (production):**  
`https://api.yourdomain.com/api/marketplace/tutor/mailbox/google/callback`

### Wrong `PUBLIC_API_URL` (doubled path)

If you see a redirect like `https://host/tutor/mailbox/.../api/marketplace/.../callback`, **`PUBLIC_API_URL` included a path** (e.g. a frontend route). The server now **strips to the origin only** (scheme + host + port), but you should still set:

- **`PUBLIC_API_URL=https://lms-work.onrender.com`** (no path, no trailing slash)

Register that exact callback in Google:

`https://lms-work.onrender.com/api/marketplace/tutor/mailbox/google/callback`

### Fix

1. **Google Cloud Console** → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID** (Web application).
2. Under **Authorized redirect URIs**, click **Add URI** and paste the **exact** URL your server uses:
   - No trailing slash on the full path.
   - Use **`https://`** in production (not `http://` unless you only use localhost).
3. **Render / hosting:** Set **`PUBLIC_API_URL`** (or **`APP_URL`**) to the same origin **without** a trailing slash, e.g. `https://api.yourdomain.com`.  
   The code now prefers `PUBLIC_API_URL` so it matches other services (webhooks, etc.).
4. Optional: set **`GOOGLE_MAILBOX_REDIRECT_URI`** to the **full** callback URL if you want a fixed value independent of base URL.

After changing the redirect URI in Google, save and wait a minute, then try **Connect Gmail** again.

---

## Microsoft Outlook (`redirect_uri` issues)

Same idea for Azure:

- Default callback:  
  `{PUBLIC_API_URL or APP_URL}/api/marketplace/tutor/mailbox/microsoft/callback`
- Register that URL under the app registration’s **Redirect URIs** (or set **`MICROSOFT_MAILBOX_REDIRECT_URI`** to the full URL).

---

## Env reference

| Variable | Purpose |
|----------|---------|
| `PUBLIC_API_URL` | Public API base (no trailing slash). Used to build Gmail/Outlook redirect URIs. |
| `APP_URL` | Fallback if `PUBLIC_API_URL` is unset. |
| `GOOGLE_MAILBOX_REDIRECT_URI` | Optional full Gmail callback URL (overrides the default). |
| `GOOGLE_MAILBOX_CLIENT_ID` / `GOOGLE_MAILBOX_CLIENT_SECRET` | OAuth client (or shared `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). |
| `MICROSOFT_MAILBOX_REDIRECT_URI` | Optional full Outlook callback URL. |
| `MICROSOFT_MAILBOX_CLIENT_ID` / `MICROSOFT_MAILBOX_CLIENT_SECRET` | Azure app registration. |

---

## Local development

Use:

```
http://localhost:3000/api/marketplace/tutor/mailbox/google/callback
```

Add that exact URI to the same OAuth client (or a separate “Web” client for dev).
