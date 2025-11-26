import { pool } from "./connect.js";

export async function saveProductHistory(url, data) {
    await pool.query(
        `INSERT INTO products (url, title, price, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [url, data.title, data.price]
    );
}