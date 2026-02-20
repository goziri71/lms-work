# Job Board - Frontend Implementation Guide

## Overview

The Job Board integrates the **German Federal Employment Agency (Bundesagentur für Arbeit)** job database into the platform. Students can search job listings, filter by various criteria, and save/bookmark jobs for later. Jobs are primarily remote opportunities from German companies that anyone worldwide can apply to.

**Base URL:** `https://lms-work.onrender.com/api/marketplace`

**Authentication:** All endpoints require student auth: `Authorization: Bearer <student_token>`

---

## Endpoints

### 1. Search Jobs

```
GET /jobs/search
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `was` | string | Keyword search (job title, skills) | `Software Developer`, `React`, `Informatik` |
| `berufsfeld` | string | Job field / profession area | `Informatik`, `Marketing` |
| `arbeitszeit` | string | Work type (semicolon-separated) | `ho`, `tz;ho` |
| `angebotsart` | string | Offer type | `1`, `4` |
| `befristung` | string | Contract type | `1`, `2` |
| `veroeffentlichtseit` | number | Published within X days (0-100) | `30` |
| `zeitarbeit` | string | Include temp agency jobs | `true`, `false` |
| `arbeitgeber` | string | Employer name | `Deutsche Bahn AG` |
| `page` | number | Page number (starts at 1) | `1` |
| `size` | number | Results per page (max 100) | `25` |

**Work Type (`arbeitszeit`) Values:**

| Value | Meaning |
|-------|---------|
| `ho` | Remote / Home Office |
| `tz` | Part-time (Teilzeit) |
| `snw` | Shift / Night / Weekend |
| `mj` | Mini-job |

> Multiple values can be combined with semicolons: `arbeitszeit=ho;tz`

**Offer Type (`angebotsart`) Values:**

| Value | Meaning |
|-------|---------|
| `1` | Job (Arbeit) |
| `2` | Self-employment (Selbständigkeit) |
| `4` | Training / Dual Study (Ausbildung) |
| `34` | Internship / Trainee (Praktikum) |

**Contract Type (`befristung`) Values:**

| Value | Meaning |
|-------|---------|
| `1` | Temporary (befristet) |
| `2` | Permanent (unbefristet) |

**Example Requests:**

```
# Search for remote software developer jobs
GET /jobs/search?was=Software%20Developer&arbeitszeit=ho&page=1&size=25

# Search for IT internships published in last 7 days
GET /jobs/search?berufsfeld=Informatik&angebotsart=34&veroeffentlichtseit=7

# Search for permanent remote jobs
GET /jobs/search?arbeitszeit=ho&befristung=2&page=1&size=10
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "abc123-def456",
        "title": "Software Developer (m/w/d) - Remote",
        "employer": "Tech GmbH",
        "location": "Berlin",
        "region": "Berlin",
        "country": "Deutschland",
        "published_date": "2025-01-15",
        "work_type": "HOME_OFFICE",
        "contract_type": "UNBEFRISTET",
        "offer_type": "ARBEIT",
        "job_url": "https://example.com/apply",
        "logo_url": "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/ed/v1/arbeitgeberlogo/abc123",
        "is_saved": false,
        "raw": {
          "...original German API fields..."
        }
      }
    ],
    "total": 150,
    "page": 1,
    "size": 25,
    "total_pages": 6,
    "cache_source": "api"
  }
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `id` | Unique job identifier (use for save/unsave) |
| `title` | Job title |
| `employer` | Company name |
| `location` | City |
| `region` | German state/region |
| `country` | Always "Deutschland" |
| `published_date` | When the job was posted |
| `work_type` | Work arrangement |
| `contract_type` | Temporary or permanent |
| `offer_type` | Job, internship, training, etc. |
| `job_url` | External link to apply |
| `logo_url` | Employer logo (may be null) |
| `is_saved` | Whether the current student has bookmarked this job |
| `raw` | Full original response from the German API |
| `cache_source` | Where the data came from: `memory`, `database`, `api`, or `stale_database` |

> **`cache_source`** is for debugging. `memory` = fastest (cached <10 min ago), `database` = cached <1 hour ago, `api` = fresh from external API, `stale_database` = API was down, serving old data.

---

### 2. Save / Bookmark a Job

```
POST /jobs/save
Content-Type: application/json
```

**Body:**

```json
{
  "job_hash_id": "abc123-def456",
  "title": "Software Developer (m/w/d) - Remote",
  "employer": "Tech GmbH",
  "location": "Berlin",
  "job_url": "https://example.com/apply",
  "job_data": {
    "...optional: store full job object for offline access..."
  }
}
```

**Required:** `job_hash_id`, `title`
**Optional:** `employer`, `location`, `job_url`, `job_data`

> **Tip:** Pass the `id` from the search result as `job_hash_id`. Store the full `raw` object in `job_data` so the student can view job details even if the cache expires.

**Response (201):**

```json
{
  "success": true,
  "message": "Job saved successfully",
  "data": {
    "id": 1,
    "job_hash_id": "abc123-def456",
    "title": "Software Developer (m/w/d) - Remote"
  }
}
```

**Errors:**
- `409` — Job already saved by this student

---

### 3. Unsave / Remove Bookmark

```
DELETE /jobs/save/:jobHashId
```

**Example:**

```
DELETE /jobs/save/abc123-def456
```

**Response:**

```json
{
  "success": true,
  "message": "Job removed from saved list"
}
```

---

### 4. Get Saved Jobs

```
GET /jobs/saved?page=1&limit=20
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |

**Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": 1,
        "job_hash_id": "abc123-def456",
        "title": "Software Developer (m/w/d) - Remote",
        "employer": "Tech GmbH",
        "location": "Berlin",
        "job_url": "https://example.com/apply",
        "job_data": { "...full job snapshot..." },
        "saved_at": "2025-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

---

## Error Responses

```json
{
  "success": false,
  "message": "Error description"
}
```

| Code | Meaning |
|------|---------|
| 400 | Bad request (validation error) |
| 401 | Not authenticated |
| 409 | Job already saved |
| 404 | Saved job not found (for unsave) |
| 500 | Job search temporarily unavailable |

---

## Frontend UI Recommendations

### Job Search Page

1. **Search Bar** — Main keyword input (`was` parameter)
2. **Filter Panel** — Dropdowns/toggles for:
   - **Job Field** (`berufsfeld`) — text input or predefined list
   - **Work Type** (`arbeitszeit`) — checkboxes: Remote, Part-time, Shift work, Mini-job
   - **Offer Type** (`angebotsart`) — dropdown: Job, Self-employment, Training, Internship
   - **Contract** (`befristung`) — toggle: Temporary / Permanent
   - **Posted Within** (`veroeffentlichtseit`) — dropdown: Last 7 days, 14 days, 30 days, 90 days
   - **Employer** (`arbeitgeber`) — text input
   - **Temp Agency Jobs** (`zeitarbeit`) — toggle on/off
3. **Results List** — Cards showing:
   - Job title, employer name, employer logo (if available)
   - Location + work type badges (Remote, Part-time, etc.)
   - Published date
   - Save/bookmark button (heart icon or bookmark icon)
   - "Apply" button → opens `job_url` in new tab
4. **Pagination** — Page numbers or infinite scroll

### Saved Jobs Page

- List of bookmarked jobs with same card layout
- "Remove" button to unsave
- Use `job_data` to display full details without re-searching
- Sort by `saved_at` (most recent first)

### Handling German Text

Many job titles and descriptions will be in German. Consider:
- Adding a "Translate" button that uses browser translation or a translation API
- Showing both original German title and a note that jobs are from Germany
- A banner at the top: "These are remote jobs from German companies. Applications are open worldwide."

### Caching Indicator (Optional)

The `cache_source` field can be used to show a subtle indicator:
- `api` → "Fresh results"
- `memory` or `database` → "Cached results (updated recently)"
- `stale_database` → "Showing older results — job service temporarily unavailable"
