# WPU book catalog migration

MySQL dump `uploads` → Postgres table **`wpu_book_uploads`**, with PDF URLs built from:

`WPU_BOOKS_BASE_URL` + `/` + URL-encoded `file` (filename)

Default base: `https://app.pinnacleuniversity.co/uploads/files`

---

## One-time migration

1. Place the MySQL dump at **`scripts/data/wpu_uploads.sql`** (or pass a path argument).
2. Ensure `.env` has valid **Postgres** `DATABASE_URL` / `DB_*` (same DB as the LMS).
3. Run:

```bash
npm run migrate:wpu-uploads
```

Optional:

- `WPU_TRUNCATE=true` — empty `wpu_book_uploads` before insert (re-import from scratch).
- Custom file: `node src/scripts/migrateWpuUploads.js /path/to/dump.sql`

Re-running without truncate uses **`ignoreDuplicates`** (skips existing primary keys).

---

## API (for frontend)

**GET** `/api/wpu/books` — requires `Authorization: Bearer <token>` (same as other student/staff JWT routes).

Results are always limited to **`type = 'book'`** (other types in the table are excluded).

**Query params:** `book_no`, `course_level`, `course_semester`, `search` (title / book_no / file), `page`, `limit` (max 200).

Each item includes **`pdf_url`** (ready to open in a new tab or iframe, subject to CORS/host policy on Pinnacle).

---

## Env

| Variable | Purpose |
|----------|---------|
| `WPU_BOOKS_BASE_URL` | Override PDF base (no trailing slash). |

---

## Notes

- **208** rows imported from the bundled dump (one row skipped where `file` was empty).
- Duplicate **`book_no`** values in the source data remain; filter in UI or dedupe later if needed.
