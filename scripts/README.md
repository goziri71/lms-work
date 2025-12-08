# Database Cleanup Script

## Quick Start

Run this command to clean single quotes from your database:

```bash
npm run cleanup:database
```

Or directly:

```bash
node scripts/cleanup-database.js
```

## What It Does

✅ **Safely removes single quotes (`'`) from all string fields**
- Removes single quotes from data
- Trims whitespace
- Lowercases email addresses
- **Does NOT delete any tables, columns, or records**

## How It Works

1. **Connects** to your database (uses your `.env` configuration)
2. **Checks** what needs cleaning (shows you a summary)
3. **Asks for confirmation** before making changes
4. **Cleans** all affected records
5. **Verifies** the cleanup was successful

## Example Output

```
============================================================
  DATABASE CLEANUP: Remove Single Quotes (')
============================================================

⚠️  IMPORTANT: This script will:
   ✅ Remove single quotes from all string fields
   ✅ Trim whitespace
   ✅ Lowercase email addresses
   ❌ Will NOT delete any tables, columns, or records

🔌 Connecting to database...
✅ Database connection established

🔍 Checking database for single quotes...

📊 Summary of records with single quotes:

  students: 5 record(s)
    - email: 3
    - password: 2
  staff: 2 record(s)
    - email: 2

  Total: 7 record(s) need cleaning

Do you want to proceed with cleanup? (yes/no): yes

🧹 Starting database cleanup...

  ✅ Cleaned 3 record(s) in students.email
  ✅ Cleaned 2 record(s) in students.password
  ✅ Cleaned 2 record(s) in staff.email

✅ Cleanup completed! Total records cleaned: 7

🔍 Verifying cleanup...

  ✅ All checked fields are clean!

✅ Database cleanup completed successfully!
```

## Safety Features

- ✅ Uses database transactions (can rollback if needed)
- ✅ Only updates records that contain single quotes
- ✅ Shows you what will be cleaned before proceeding
- ✅ Asks for confirmation
- ✅ Verifies cleanup after completion

## Tables Cleaned

- `students` - Email, password, names, phone, matric_number, etc.
- `staff` - Email, password, full_name, phone, etc.
- `wsp_admins` - Email, password, names, phone, tokens, etc.
- `courses` - Title, course_code, token, etc.
- `organizations` - Email, password, name, phone, etc.
- `sole_tutors` - Email, password, names, phone, etc.
- `organization_users` - Email, password, names, phone, etc.

## Troubleshooting

### "Cannot find module" error
Make sure you're running from the project root directory.

### "Database connection failed"
Check your `.env` file has the correct database credentials:
- `DB_NAME` or `DATABASE_URL`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`

### Script skips some tables
If a table or column doesn't exist, the script will skip it automatically. This is normal.

## Important Notes

⚠️ **Always backup your database before running this script!**

The script is safe and only updates data, but it's always good practice to have a backup.

