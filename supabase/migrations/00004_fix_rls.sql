-- ============================================================
-- RLS Policies for Production
-- Jalankan di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ifygohsttchhgxozcwcd/sql/new
-- ============================================================

-- 1. ORDERS table — allow all SELECT for anon
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;
CREATE POLICY "Enable read access for all users" ON orders
  FOR SELECT USING (true);

-- 2. ORDER_ITEMS table — allow all SELECT for anon
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON order_items;
CREATE POLICY "Enable read access for all users" ON order_items
  FOR SELECT USING (true);

-- 3. SCANS table — allow all SELECT for anon
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON scans;
CREATE POLICY "Enable read access for all users" ON scans
  FOR SELECT USING (true);

-- 4. USER_ROLES table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_roles;
CREATE POLICY "Enable read access for all users" ON user_roles
  FOR SELECT USING (true);

-- Verify
SELECT 'orders' as tbl, count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'scans', count(*) FROM scans
UNION ALL SELECT 'user_roles', count(*) FROM user_roles;
