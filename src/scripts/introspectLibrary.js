import { dbLibrary } from "../database/database.js";

const TABLES = ["quiz_questions", "quiz_options", "quiz_answers"];

async function getTableInfo(tableName) {
  const [columns] = await dbLibrary.query(
    `
    SELECT
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = $1
    ORDER BY c.ordinal_position;
  `,
    { bind: [tableName] }
  );

  const [constraints] = await dbLibrary.query(
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
    console.log(`\n=== ${t} ===`);
    const info = await getTableInfo(t);
    console.table(info.columns);
    console.log("Constraints:", info.constraints);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Introspection failed:", err?.message || err);
  process.exit(1);
});
