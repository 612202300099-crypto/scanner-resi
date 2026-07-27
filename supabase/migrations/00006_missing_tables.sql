-- ============================================================
-- Missing Tables for Production
-- Jalankan di: https://supabase.com/dashboard/project/zervdttmbpenbujkjcrn/sql/new
-- ============================================================

-- 1. DESTY_COUNTS — cached Desty API counts (updated by sync script)
CREATE TABLE IF NOT EXISTS desty_counts (
    id INTEGER PRIMARY KEY DEFAULT 1,
    ready_to_ship INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    to_process INTEGER DEFAULT 0,
    in_delivery INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    shipping INTEGER DEFAULT 0,
    unpaid INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE desty_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON desty_counts;
CREATE POLICY "anon_read" ON desty_counts FOR SELECT USING (true);

-- 2. DESTY_SYNC_LOG — sync history
CREATE TABLE IF NOT EXISTS desty_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    new_orders INTEGER DEFAULT 0,
    updated_orders INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    error TEXT
);
ALTER TABLE desty_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON desty_sync_log;
CREATE POLICY "anon_read" ON desty_sync_log FOR SELECT USING (true);

-- 3. DESTY_API_CONFIG — (placeholder, not used with auto-sync)
CREATE TABLE IF NOT EXISTS desty_api_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE desty_api_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON desty_api_config;
CREATE POLICY "anon_read" ON desty_api_config FOR SELECT USING (true);
INSERT INTO desty_api_config (is_active) VALUES (true) ON CONFLICT DO NOTHING;

-- 4. DAILY_SHIPPING_QUEUE — (placeholder)
CREATE TABLE IF NOT EXISTS daily_shipping_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE daily_shipping_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON daily_shipping_queue;
CREATE POLICY "anon_read" ON daily_shipping_queue FOR SELECT USING (true);

-- 5. Seed initial counts
INSERT INTO desty_counts (id, ready_to_ship, processed, to_process, in_delivery, delivered, shipping, unpaid)
VALUES (1, 284, 283, 1, 241, 1488, 1729, 3)
ON CONFLICT (id) DO UPDATE SET
    ready_to_ship = 284, processed = 283, to_process = 1,
    in_delivery = 241, delivered = 1488, shipping = 1729, unpaid = 3,
    updated_at = NOW();

-- Verify
SELECT 'desty_counts' as tbl, count(*) FROM desty_counts
UNION ALL SELECT 'desty_sync_log', count(*) FROM desty_sync_log
UNION ALL SELECT 'desty_api_config', count(*) FROM desty_api_config
UNION ALL SELECT 'daily_shipping_queue', count(*) FROM daily_shipping_queue
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'scans', count(*) FROM scans;
