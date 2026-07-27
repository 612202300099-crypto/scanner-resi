-- ============================================================
-- RLS Policies — jalankan di project ifygohsttchhgxozcwcd
-- https://supabase.com/dashboard/project/ifygohsttchhgxozcwcd/sql/new
-- ============================================================

-- Pastikan project benar
DO $$ BEGIN
  IF current_database() != 'postgres' THEN
    RAISE EXCEPTION 'Wrong project! This SQL must run on ifygohsttchhgxozcwcd';
  END IF;
END $$;

-- 1. ORDERS
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON public.orders;
CREATE POLICY "anon_read" ON public.orders FOR SELECT USING (true);

-- 2. ORDER_ITEMS
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON public.order_items;
CREATE POLICY "anon_read" ON public.order_items FOR SELECT USING (true);

-- 3. SCANS
ALTER TABLE IF EXISTS public.scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON public.scans;
CREATE POLICY "anon_read" ON public.scans FOR SELECT USING (true);

-- 4. USER_ROLES
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON public.user_roles;
CREATE POLICY "anon_read" ON public.user_roles FOR SELECT USING (true);

-- 5. DESTY_API_CONFIG
ALTER TABLE IF EXISTS public.desty_api_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON public.desty_api_config;
CREATE POLICY "anon_read" ON public.desty_api_config FOR SELECT USING (true);

-- Verify
SELECT 'orders' as tbl, count(*) FROM public.orders
UNION ALL SELECT 'order_items', count(*) FROM public.order_items
UNION ALL SELECT 'scans', count(*) FROM public.scans
UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles;
