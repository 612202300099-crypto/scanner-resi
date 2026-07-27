-- Add delivery_deadline column for deadline tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON orders(delivery_deadline);

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name IN ('delivery_deadline','order_create_time');
