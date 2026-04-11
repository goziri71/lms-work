# Tutor transfer PIN (bank payouts)

This feature adds a **4–6 digit PIN** plus **email verification** (6-digit OTP) for **sole tutors** and **organizations** when securing **Flutterwave bank payouts**. It does not apply to student wallets or other actions—**payout protection only**.

---

## What was implemented

- **PIN storage:** bcrypt hash on `sole_tutors` / `organizations` (never plaintext).
- **Email OTP:** ZeptoMail sends a 6-digit code; server stores an HMAC digest (peppered with `JWT_SECRET`).
- **Payout:** `POST .../tutor/payouts/request` accepts optional/required `transfer_pin` depending on policy (see below).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `TRANSFER_PIN_ENFORCE` | Set to `true` to **block** payouts until the tutor has completed PIN setup. If unset/false, tutors **without** a PIN can still request payouts (**grace**). Tutors **with** a PIN must send `transfer_pin` on every payout. |
| `JWT_SECRET` | Used to derive OTP verification (must remain stable in production). |
| ZeptoMail / `EMAIL_*` | Required for sending OTP emails (same as other app emails). |

---

## Database migration

One-time on each environment:

```bash
npm run migrate:tutor-transfer-pin
```

Adds columns to **`sole_tutors`** and **`organizations`** (PIN hash, lockout, OTP fields).

---

## API base

All routes below are under your marketplace API prefix, e.g. **`/api/marketplace`**, and require **`Authorization: Bearer <tutor JWT>`** (`tutorAuthorize`).

---

## Endpoints

### GET `/tutor/transfer-pin/status`

Returns:

- `transfer_pin_configured` — boolean  
- `transfer_pin_locked_until` — ISO datetime or `null` (too many wrong PIN attempts on payout)  
- `transfer_pin_enforced_by_policy` — mirrors `TRANSFER_PIN_ENFORCE`  
- `must_set_transfer_pin` — `true` when enforcement is on and no PIN is set yet  

---

### POST `/tutor/transfer-pin/send-otp`

**Body:** `{ "purpose": "setup" | "change" | "reset" }`

| Purpose | When |
|---------|------|
| `setup` | No PIN yet (first-time setup). |
| `change` | PIN exists; confirm will require **current PIN** + **new PIN** + OTP. |
| `reset` | PIN exists but tutor forgot it; logged-in session + OTP + **new PIN** only (no current PIN). |

Throttles resend (≈90s between sends). Sends email with a **6-digit code** (15-minute validity).

---

### POST `/tutor/transfer-pin/confirm`

**First-time setup**

```json
{ "purpose": "setup", "otp": "123456", "pin": "1234" }
```

`pin` must be **4–6 digits**.

**Change PIN**

```json
{ "purpose": "change", "otp": "123456", "current_pin": "1111", "new_pin": "2222" }
```

**Reset PIN (forgot)**

```json
{ "purpose": "reset", "otp": "123456", "new_pin": "3333" }
```

---

### POST `/tutor/payouts/request`

Include the same fields as before (`amount`, `bank_account_id`, `currency`, etc.) plus when applicable:

| Field | Type | When |
|-------|------|------|
| `transfer_pin` | string | **Required** if the tutor has already set a PIN. Send as **string** so leading zeros are preserved (e.g. `"001234"`). |

**Policy behavior**

- **`TRANSFER_PIN_ENFORCE=true`** and no PIN set → **403**; tutor must complete setup via `send-otp` / `confirm`.  
- **PIN set** → wrong or missing `transfer_pin` → **400**; after repeated failures **423** lockout (see status).  
- **Grace** (enforce off, no PIN) → payouts work without `transfer_pin` until the tutor chooses to set a PIN; after that, `transfer_pin` is required like above.

---

## Security limits (summary)

- Wrong **payout PIN:** up to 5 failures → temporary lock (30 minutes).  
- Wrong **OTP** at confirm:** up to 5 failures → pending OTP cleared; request a new code.  

---

## Frontend checklist

1. Before payout, call **`GET /tutor/transfer-pin/status`** to decide whether to show PIN entry or a “Set up transfer PIN” flow.  
2. **Setup:** `send-otp` (`setup`) → user enters email code + new PIN → `confirm` (`setup`).  
3. **Payout:** send `transfer_pin` in the request body when `transfer_pin_configured` is true (or when enforcement requires setup first).  
4. Handle **403** / **423** with clear UX (setup required, locked, etc.).  

---

## Related code (backend)

- `src/controllers/marketplace/tutorTransferPin.js` — status, OTP, confirm, payout assertion helper  
- `src/services/tutorTransferPinService.js` — PIN/OTP validation helpers  
- `src/controllers/marketplace/tutorPayout.js` — payout request validates PIN  
- `scripts/migrate-add-tutor-transfer-pin.js` — migration  

---

## NGN platform payout fee (Flutterwave)

**Source of truth:** database table **`platform_payout_config`** (singleton row **`id = 1`**), column **`ngn_payout_platform_fee`**.

```sql
-- Example: set fee to 100 NGN
UPDATE platform_payout_config SET ngn_payout_platform_fee = 100, updated_at = NOW() WHERE id = 1;
```

Run migration once: **`npm run migrate:platform-payout-fee`** (creates the table, seeds `100`, adds **`tutor_payouts.platform_payout_fee`** to store the fee snapshot per payout).

| Fallback | Purpose |
|----------|---------|
| `NGN_PAYOUT_PLATFORM_FEE` env | Used only if the config row cannot be read (defaults to **100** when env unset). |

Flutterwave still requires a **minimum ~100 NGN** net after our fee, so with a **100 NGN** platform fee the tutor must request at least **200 NGN** total in NGN when applicable.

The create-payout response includes **`platform_payout_fee`** and **`net_amount_after_platform_fee`** when the fee applies.

**Preview (frontend):** **`GET /api/marketplace/tutor/payouts/fee-config`** (tutor JWT) returns **`ngn_payout_platform_fee`** and **`currency`** (`NGN`) from **`platform_payout_config`** only.
