/**
 * One-time migration: MySQL `uploads` dump -> Postgres `wpu_book_uploads`.
 *
 * Usage:
 *   node src/scripts/migrateWpuUploads.js [path/to/dump.sql]
 *   WPU_TRUNCATE=true node src/scripts/migrateWpuUploads.js   # empty table first
 *
 * Default SQL path: <repo>/scripts/data/wpu_uploads.sql
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ debug: false });

import { db } from "../database/database.js";
import { WpuBookUpload } from "../models/wpu/wpuBookUpload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");
const defaultSql = path.join(repoRoot, "scripts/data/wpu_uploads.sql");

/** Parse one MySQL VALUES row (inside parentheses, without outer parens). */
function parseMysqlFieldRow(inner) {
  const fields = [];
  let i = 0;
  const s = inner.trim();
  while (i < s.length) {
    while (i < s.length && (s[i] === " " || s[i] === ",")) i++;
    if (i >= s.length) break;
    if (s[i] === "N" && s.slice(i, i + 4) === "NULL") {
      fields.push(null);
      i += 4;
      continue;
    }
    if (s[i] === "'") {
      i++;
      let buf = "";
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") {
          buf += "'";
          i += 2;
          continue;
        }
        if (s[i] === "'") {
          i++;
          break;
        }
        buf += s[i++];
      }
      fields.push(buf);
      continue;
    }
    let j = i;
    if (s[i] === "-") j++;
    while (j < s.length && /[0-9]/.test(s[j])) j++;
    if (j === i) {
      throw new Error(`Unexpected at pos ${i}: ${s.slice(i, i + 60)}`);
    }
    const num = parseInt(s.slice(i, j), 10);
    fields.push(Number.isNaN(num) ? null : num);
    i = j;
  }
  return fields;
}

function extractRowLines(sql) {
  const rows = [];
  for (const line of sql.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("(") || !/^\(\d+,/.test(t)) continue;
    let body = t;
    if (body.endsWith("),")) body = body.slice(0, -2);
    else if (body.endsWith(");")) body = body.slice(0, -2);
    else if (body.endsWith(",")) body = body.slice(0, -1);
    else if (body.endsWith(")")) body = body.slice(0, -1);
    if (body.startsWith("(")) body = body.slice(1);
    rows.push(body);
  }
  return rows;
}

function rowToRecord(fields) {
  if (fields.length !== 13) {
    throw new Error(`Expected 13 fields, got ${fields.length}: ${JSON.stringify(fields)}`);
  }
  const dateStr = fields[4];
  let uploaded_at = null;
  if (dateStr && typeof dateStr === "string") {
    const d = new Date(dateStr.replace(" ", "T") + "Z");
    uploaded_at = Number.isNaN(d.getTime()) ? null : d;
  }
  return {
    id: fields[0],
    file: fields[1],
    title: fields[2],
    size: fields[3] != null ? fields[3] : null,
    uploaded_at,
    student_id: fields[5],
    faculty_id: fields[6],
    program_id: fields[7],
    book_no: fields[8] != null ? String(fields[8]).trim() : null,
    type: fields[9],
    course_id: fields[10],
    course_level: fields[11] != null ? String(fields[11]).trim() : null,
    course_semester: fields[12] != null ? String(fields[12]).trim() : null,
  };
}

async function main() {
  const sqlPath = process.argv[2] || defaultSql;
  if (!fs.existsSync(sqlPath)) {
    console.error("SQL file not found:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const rowLines = extractRowLines(sql);
  console.log(`Parsed ${rowLines.length} row line(s) from ${sqlPath}`);

  await db.authenticate();
  console.log("DB connected.");

  await WpuBookUpload.sync({ alter: true });

  if (process.env.WPU_TRUNCATE === "true" || process.argv.includes("--truncate")) {
    await db.query('TRUNCATE TABLE "wpu_book_uploads" RESTART IDENTITY CASCADE;');
    console.log("Truncated wpu_book_uploads.");
  }

  const records = [];
  for (const line of rowLines) {
    let fields;
    try {
      fields = parseMysqlFieldRow(line);
    } catch (e) {
      console.warn("Skip bad row:", e.message);
      continue;
    }
    let rec;
    try {
      rec = rowToRecord(fields);
    } catch (e) {
      console.warn("Skip:", e.message);
      continue;
    }
    if (!rec.file || !String(rec.file).trim()) {
      console.warn(`Skip id=${rec.id} (empty file)`);
      continue;
    }
    records.push(rec);
  }

  console.log(`Inserting ${records.length} record(s)...`);

  await WpuBookUpload.bulkCreate(records, {
    ignoreDuplicates: true,
    validate: false,
  });

  await db.query(`
    SELECT setval(
      pg_get_serial_sequence('wpu_book_uploads', 'id'),
      COALESCE((SELECT MAX(id) FROM wpu_book_uploads), 1)
    );
  `);

  const [countRows] = await db.query(
    "SELECT COUNT(*)::int AS count FROM wpu_book_uploads"
  );
  console.log(`Done. Rows in wpu_book_uploads: ${countRows[0]?.count}`);
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
