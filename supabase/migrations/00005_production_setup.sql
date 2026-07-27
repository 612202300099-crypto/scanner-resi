-- ============================================================
-- DESTY INTEGRATION — Production Setup
-- Jalankan di: https://supabase.com/dashboard/project/zervdttmbpenbujkjcrn/sql/new
-- ============================================================

-- 1. ORDERS table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    desty_order_id TEXT UNIQUE NOT NULL,
    order_sn TEXT DEFAULT '',
    platform TEXT DEFAULT 'unknown',
    platform_name TEXT DEFAULT '',
    store_name TEXT DEFAULT '',
    order_status TEXT DEFAULT 'Processed',
    customer_name TEXT DEFAULT '',
    shipping_city TEXT DEFAULT '',
    shipping_province TEXT DEFAULT '',
    shipping_address TEXT DEFAULT '',
    total_price NUMERIC DEFAULT 0,
    cod_order BOOLEAN DEFAULT false,
    order_create_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ORDER_ITEMS table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_name TEXT DEFAULT '',
    item_code TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    tracking_number TEXT DEFAULT '',
    courier TEXT DEFAULT '',
    is_shipped BOOLEAN DEFAULT false,
    image_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_desty_id ON orders(desty_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_name);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tracking ON order_items(tracking_number);

-- 4. RLS — allow anon SELECT
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON orders;
CREATE POLICY "anon_read" ON orders FOR SELECT USING (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON order_items;
CREATE POLICY "anon_read" ON order_items FOR SELECT USING (true);

-- 5. Verify
SELECT 'orders' as tbl, count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'scans', count(*) FROM scans
UNION ALL SELECT 'user_roles', count(*) FROM user_roles;
