# Organization & Tutor KYC

**Base:** `/api/marketplace` (submit) · `/api/admin` (review)

Same tutor endpoints serve both account types. Response includes `kyc_type`: `sole_tutor` | `organization`.

`organization_user` accounts **cannot** submit KYC — only the organization owner account.

---

## Migration

```bash
node scripts/migrate-add-organization-kyc.js
```

(Uses LMS DB only; ignores library DB.)

---

## Tutor / org submit

| Method | Path | Auth |
|--------|------|------|
| GET | `/tutor/kyc` | Tutor JWT |
| POST | `/tutor/kyc` | Tutor JWT + `multipart/form-data` |
| PUT | `/tutor/kyc` | Tutor JWT + `multipart/form-data` |

### Sole tutor fields

| Field | Type |
|-------|------|
| `bvn` | text |
| `national_id_type` | `national_id` \| `passport` \| `drivers_license` \| `voters_card` \| `other` |
| `national_id_number` | text |
| `national_id` | file |
| `proof_of_address` | file |
| `passport_photo` | file |

### Organization fields (business)

**Required**

| Field | Type |
|-------|------|
| `business_name` | text |
| `cac_number` | text (RC / BN) |
| `cac_certificate` | file (PDF/image) |

**Optional**

| Field | Type |
|-------|------|
| `trading_name` | text |
| `business_type` | `limited_company` \| `business_name` \| `ngo` \| `partnership` \| `sole_proprietorship` \| `other` |
| `tin` | text |
| `date_of_incorporation` | `YYYY-MM-DD` |
| `registered_address` | text |
| `operating_address` | text |
| `business_email` | text |
| `business_phone` | text |
| `nature_of_business` | text |
| `directors` | JSON string array `[{ "name", "role" }]` |
| `cac_status_report` | file |
| `memorandum_articles` | file |
| `proof_of_address` | file |
| `tax_document` | file |
| `authorized_rep_id` | file |

Example (org):

```bash
curl -X POST "$API/api/marketplace/tutor/kyc" \
  -H "Authorization: Bearer $ORG_TOKEN" \
  -F "business_name=Acme Learning Ltd" \
  -F "cac_number=RC123456" \
  -F "business_type=limited_company" \
  -F "tin=12345678-0001" \
  -F "registered_address=12 Broad St, Lagos" \
  -F "cac_certificate=@./cac.pdf" \
  -F "proof_of_address=@./address.pdf"
```

On approve, `organizations.verification_status` → `verified`. On reject → `rejected`.

---

## Admin review

### Sole tutors (existing)

| Method | Path |
|--------|------|
| GET | `/tutor-kyc` |
| GET | `/tutor-kyc/stats` |
| GET | `/tutor-kyc/:id` |
| PUT | `/tutor-kyc/:id/approve` |
| PUT | `/tutor-kyc/:id/reject` |
| PUT | `/tutor-kyc/:id/request-resubmission` |

### Organizations (new)

| Method | Path |
|--------|------|
| GET | `/organization-kyc?status=pending&page=1` |
| GET | `/organization-kyc/stats` |
| GET | `/organization-kyc/:id` |
| PUT | `/organization-kyc/:id/approve` body `{ "notes"? }` |
| PUT | `/organization-kyc/:id/reject` body `{ "rejection_reason" }` |
| PUT | `/organization-kyc/:id/request-resubmission` body `{ "resubmission_notes" }` |

---

## FE checklist

- [ ] Detect `userType` — sole tutor form vs organization business form  
- [ ] Org: require business name, CAC number, CAC certificate upload  
- [ ] Show status + rejection / resubmission notes from `GET /tutor/kyc`  
- [ ] Admin: separate queues for tutor-kyc vs organization-kyc  
