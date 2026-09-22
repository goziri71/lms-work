/**
 * Sync free-tier tutor_subscriptions rows to new Free limits:
 * 5 courses, 5 digital downloads, 1 community, 1 membership
 *
 * Run: node scripts/sync-free-subscription-limits.js
 */
import dotenv from "dotenv";
import { Sequelize, QueryTypes } from "sequelize";

dotenv.config({ debug: false });

const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  }
);

await db.authenticate();

const before = await db.query(
  `SELECT courses_limit, communities_limit, digital_downloads_limit, memberships_limit, COUNT(*)::int AS n
   FROM tutor_subscriptions
   WHERE subscription_tier = 'free'
   GROUP BY 1, 2, 3, 4`,
  { type: QueryTypes.SELECT }
);
console.log("BEFORE", before);

const [, meta] = await db.query(`
  UPDATE tutor_subscriptions
  SET courses_limit = 5,
      communities_limit = 1,
      digital_downloads_limit = 5,
      memberships_limit = 1,
      updated_at = NOW()
  WHERE subscription_tier = 'free'
`);
console.log("UPDATED rows:", meta?.rowCount);

const after = await db.query(
  `SELECT courses_limit, communities_limit, digital_downloads_limit, memberships_limit, COUNT(*)::int AS n
   FROM tutor_subscriptions
   WHERE subscription_tier = 'free'
   GROUP BY 1, 2, 3, 4`,
  { type: QueryTypes.SELECT }
);
console.log("AFTER", after);
await db.close();
