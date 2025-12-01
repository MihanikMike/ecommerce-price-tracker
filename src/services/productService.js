import { pool } from "../db/connect-pg.js";
import logger from "../utils/logger.js";

export async function upsertProductAndHistory({ url, site, title, price, currency }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `INSERT INTO products (url,site,title,last_seen_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, last_seen_at = now()
       RETURNING id`,
      [url, site, title]
    );
    const productId = res.rows[0].id;
    await client.query(
      `INSERT INTO price_history(product_id, price, currency, captured_at) VALUES ($1,$2,$3,now())`,
      [productId, price, currency || 'USD']
    );
    await client.query("COMMIT");
    logger.debug({ productId, url, price }, 'Product and price history saved');
    return productId;
  } catch (e) {
    await client.query("ROLLBACK");
    logger.error({ error: e, url }, 'Failed to save product');
    throw e;
  } finally {
    client.release();
  }
}