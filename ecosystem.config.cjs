/**
 * PM2 cluster config. Fixed at 2 workers (not "max"/0) because the Postgres
 * instances backing this app are on a free tier with ~22 connection limit
 * each; every worker opens its own DB pool (see src/config/config.js —
 * DB_POOL_MAX), so raise `instances` only after upgrading the Postgres plan
 * (or a pooler like PgBouncer is in front) and increasing DB_POOL_MAX to
 * match. Boot-time schema sync and cron-style background jobs in app.js are
 * gated to run in a single worker (NODE_APP_INSTANCE === "0"), which PM2
 * sets automatically per worker in cluster mode.
 */
module.exports = {
  apps: [
    {
      name: "lms-web",
      script: "app.js",
      exec_mode: "cluster",
      instances: 2,
    },
  ],
};
