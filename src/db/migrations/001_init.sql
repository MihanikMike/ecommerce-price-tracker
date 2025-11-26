-- products: основной продукт
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  site TEXT,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- history: история цен
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(10,2),
  currency TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- индексы
CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);