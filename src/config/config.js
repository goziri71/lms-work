import dotenv from "dotenv";
dotenv.config();

export const Config = {
  port: process.env.PORT || 3000,

  database: {
    name: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    dialect: "postgres",
    port: process.env.DB_PORT,
    dialectOptions: {
      ssl:
        process.env.NODE_ENV === "production"
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
  },
};
