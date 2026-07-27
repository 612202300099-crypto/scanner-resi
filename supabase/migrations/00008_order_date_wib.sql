-- Add WIB date column for accurate date filtering
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date_wib TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_date_wib ON orders(order_date_wib);

-- Populate from existing order_create_time (UTC to WIB conversion)
UPDATE orders SET order_date_wib = to_char((order_create_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD')
WHERE order_date_wib IS NULL AND order_create_time IS NOT NULL;
