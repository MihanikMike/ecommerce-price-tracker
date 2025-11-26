import dotenv from "dotenv";
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  pg: {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  },
  retries: 3,
  minDelay: 1200,
  maxDelay: 2500,
  mongoUri: process.env.MONGO_URI,
  logLevel: process.env.LOG_LEVEL,
  userAgentsFile: process.env.USER_AGENTS,
};