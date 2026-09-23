import dotenv from "dotenv";
import {
  DEFAULT_ADMIN_FRONTEND_URL,
  DEFAULT_FRONTEND_URL,
  normalizeFrontendUrlBase,
} from "../utils/frontendUrl.js";

dotenv.config({ debug: false });

/**
 * Render free-tier Postgres caps out around 22 total connections per
 * instance. Each pool here talks to a separate Postgres instance (main +
 * library), so this budget applies independently to each. The app runs as
 * a 2-worker PM2 cluster (see ecosystem.config.cjs), and each worker gets
 * its own pool of this size, so keep worker_count * DB_POOL_MAX comfortably
 * under 22 (6 * 2 = 12, leaving ~10 connections for psql/scripts/migrations
 * running alongside the app). Raise this only after upgrading the Postgres
 * plan or reducing worker count accordingly.
 */
const dbPoolMax = parseInt(process.env.DB_POOL_MAX || "6", 10);
const dbPoolMin = parseInt(process.env.DB_POOL_MIN || "0", 10);
const dbPoolAcquire = parseInt(process.env.DB_POOL_ACQUIRE_MS || "15000", 10);

const createPoolConfig = () => ({
  max: dbPoolMax,
  min: dbPoolMin,
  acquire: dbPoolAcquire,
  idle: 10000,
  evict: 1000,
});

const pgDialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "20000", 10),
  idle_in_transaction_session_timeout: parseInt(
    process.env.DB_IDLE_TX_TIMEOUT_MS || "10000",
    10
  ),
};

export const Config = {
  port: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,

  // Redis Configuration
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: process.env.REDIS_PORT || 6380,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // Stream Video
  streamApiKey: process.env.STREAM_API_KEY,
  streamSecret: process.env.STREAM_SECRET,
  streamDefaultRegion: process.env.STREAM_DEFAULT_REGION || "auto",

  database: {
    name: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    dialect: "postgres",
    port: process.env.DB_PORT,
    url: process.env.DATABASE_URL,
    dialectOptions: pgDialectOptions,
    pool: createPoolConfig(),
  },

  databaseLibrary: {
    name: process.env.DATABASE_N,
    username: process.env.DATABASE_U,
    password: process.env.DATABASE_P,
    host: process.env.DATABASE_H,
    dialect: "postgres",
    port: process.env.DB_PORT,
    dialectOptions: pgDialectOptions,
    pool: createPoolConfig(),
  },

  // Tutor mailbox OAuth (optional; falls back to GOOGLE_* / APP_URL)
  mailboxGoogleRedirectUri: process.env.GOOGLE_MAILBOX_REDIRECT_URI,
  mailboxMicrosoftRedirectUri: process.env.MICROSOFT_MAILBOX_REDIRECT_URI,

  // Email Configuration (ZeptoMail)
  email: {
    apiUrl: process.env.ZEPTOMAIL_API_URL,
    apiToken: process.env.ZEPTOMAIL_TOKEN,
    fromAddress: process.env.EMAIL_FROM_ADDRESS,
    /** Default “from” display name (academic, admin, tutor billing, etc.) */
    fromName: process.env.EMAIL_FROM_NAME || "Pinnacle",
    /** Tutor ↔ learner marketplace emails (coaching, community to learner, tutor message to learner) */
    fromNameTutorLearner: process.env.EMAIL_FROM_NAME_TUTOR_LEARNER || "The Nomada",
    enabled: process.env.EMAIL_ENABLED === "true" || true,
  },

  // Tutor payout transfer PIN: when true, payouts are blocked until PIN is set + email verification
  transferPin: {
    enforce: process.env.TRANSFER_PIN_ENFORCE === "true",
  },

  /** Canonical app URL (always ends with `/`). Env: FRONTEND_URL */
  get frontendUrl() {
    return normalizeFrontendUrlBase(process.env.FRONTEND_URL, DEFAULT_FRONTEND_URL);
  },
  /** Admin site URL (always ends with `/`). Env: ADMIN_FRONTEND_URL */
  get adminFrontendUrl() {
    return normalizeFrontendUrlBase(
      process.env.ADMIN_FRONTEND_URL,
      DEFAULT_ADMIN_FRONTEND_URL
    );
  },

  /** Base URL for WPU PDFs (no trailing slash). Filename appended + encoded. */
  wpuBooksBaseUrl:
    process.env.WPU_BOOKS_BASE_URL || "https://app.pinnacleuniversity.co/uploads/files",

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
  },
};
