import { db } from "../database/database.js";

const TABLES = ["students", "courses", "course_reg"]; // adjust if needed

async function getTableInfo(tableName) {
  const [columns] = await db.query(
    `
    SELECT
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = $1
    ORDER BY c.ordinal_position;
  `,
    { bind: [tableName] }
  );

  const [constraints] = await db.query(
    `
    SELECT tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = $1
    ORDER BY tc.constraint_type, kcu.ordinal_position;
  `,
    { bind: [tableName] }
  );

  return { columns, constraints };
}

async function main() {
  for (const t of TABLES) {
    // eslint-disable-next-line no-console
    console.log(`\n=== ${t} ===`);
    const info = await getTableInfo(t);
    // eslint-disable-next-line no-console
    console.table(info.columns);
    // eslint-disable-next-line no-console
    console.log("Constraints:", info.constraints);
  }
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Introspection failed:", err?.message || err);
  process.exit(1);
});
