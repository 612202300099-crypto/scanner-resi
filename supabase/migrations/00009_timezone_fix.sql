-- ============================================================
-- TIMEZONE FIX: Store dates as TEXT (WIB) not TIMESTAMPTZ
-- ============================================================

-- 1. Add order_date_wib (TEXT) for date filtering
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date_wib TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_date_wib ON orders(order_date_wib);

-- 2. Add deadline_date (TEXT, WIB) for deadline display
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deadline_date TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_deadline_date ON orders(deadline_date);

-- 3. Add deadline_time (TEXT, WIB "HH:MM") for time comparison
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deadline_time TEXT;

-- 4. Populate from existing data
UPDATE orders 
SET order_date_wib = to_char((order_create_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD')
WHERE order_date_wib IS NULL AND order_create_time IS NOT NULL;

UPDATE orders 
SET deadline_date = to_char((delivery_deadline AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD')
WHERE deadline_date IS NULL AND delivery_deadline IS NOT NULL;

UPDATE orders 
SET deadline_time = to_char((delivery_deadline AT TIME ZONE 'Asia/Jakarta')::time, 'HH24:MI')
WHERE deadline_time IS NULL AND delivery_deadline IS NOT NULL;
