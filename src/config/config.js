import dotenv from "dotenv";
dotenv.config({ debug: false });

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
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 20, // Increased for better concurrency
      min: 5,
      acquire: 30000,
      idle: 10000,
      evict: 1000, // Check for idle connections every second
    },
  },

  databaseLibrary: {
    name: process.env.DATABASE_N,
    username: process.env.DATABASE_U,
    password: process.env.DATABASE_P,
    host: process.env.DATABASE_H,
    dialect: "postgres",
    port: process.env.DB_PORT,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    pool: {
      max: 20, // Increased for better concurrency
      min: 5, // Keep connections warm
      acquire: 30000,
      idle: 10000,
      evict: 1000, // Check for idle connections every second
    },
  },

  // Email Configuration (ZeptoMail)
  email: {
    apiUrl: process.env.ZEPTOMAIL_API_URL,
    apiToken: process.env.ZEPTOMAIL_TOKEN,
    fromAddress: process.env.EMAIL_FROM_ADDRESS,
    fromName: process.env.EMAIL_FROM_NAME || "Pinnacle University",
    enabled: process.env.EMAIL_ENABLED === "true" || true,
  },

  // Frontend URL for email links
  frontendUrl: process.env.FRONTEND_URL || "https://app.knomada.co",
};
