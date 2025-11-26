import pkg from "pg";
const { Pool } = pkg;
import config from "../config/index.js";

export const pool = new Pool({
  user: config.pg.user,
  host: config.pg.host,
  database: config.pg.database,
  password: config.pg.password,
  port: config.pg.port
});

export async function runMigrations() {
  const fs = await import("fs");
  const sql = fs.readFileSync("./src/db/migrations/001_init.sql", "utf8");
  await pool.query(sql);
}