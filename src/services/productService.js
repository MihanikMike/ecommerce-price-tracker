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
    return productId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}