import dotenv from "dotenv";
dotenv.config({ debug: false });

export const Config = {
  port: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,

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
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000,
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
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
  },
};
