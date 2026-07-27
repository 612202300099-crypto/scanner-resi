-- ============================================================
-- MIGRATION 00001: INITIAL SCHEMA (Production Mirror + Desty)
-- Combined: all tables first, then all RLS/policies/triggers
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PHASE 1: ALL CREATE TABLE STATEMENTS
-- ============================================================

-- TABLE: scans
CREATE TABLE IF NOT EXISTS public.scans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    resi TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('MASUK', 'KELUAR', 'RETUR')),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    scanned_date DATE DEFAULT CURRENT_DATE,
    scanned_time TEXT,
    scanned_day TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    order_item_id UUID,
    shipment_id UUID
);

-- TABLE: user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    full_name TEXT NOT NULL DEFAULT 'Staff Gudang',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: delivery_notes
CREATE TABLE IF NOT EXISTS public.delivery_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    note_date DATE DEFAULT CURRENT_DATE,
    sender_name TEXT NOT NULL,
    sender_address TEXT,
    expedition TEXT NOT NULL,
    courier_name TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    photo_data TEXT,
    photo_source TEXT CHECK (photo_source IN ('camera', 'gallery')),
    is_finalized BOOLEAN DEFAULT false,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: orders (Desty)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    desty_order_id TEXT UNIQUE NOT NULL,
    order_sn TEXT,
    booking_sn TEXT,
    platform TEXT NOT NULL,
    platform_name TEXT,
    store_id TEXT,
    store_name TEXT,
    order_type TEXT DEFAULT 'DEFAULT_ORDER',
    order_status TEXT NOT NULL,
    sub_status TEXT,
    logistic_status TEXT,
    shipped_status TEXT DEFAULT 'NotShipped',
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    buyer_notes TEXT,
    shipping_full_name TEXT,
    shipping_address TEXT,
    shipping_area TEXT,
    shipping_city TEXT,
    shipping_province TEXT,
    shipping_post_code TEXT,
    shipping_phone TEXT,
    delivery_deadline TIMESTAMPTZ,
    sub_total DECIMAL(15,2),
    discount DECIMAL(15,2),
    tax DECIMAL(15,2),
    total_price DECIMAL(15,2),
    insurance_cost DECIMAL(15,2),
    payment_method TEXT,
    cod_order BOOLEAN DEFAULT false,
    has_paid BOOLEAN DEFAULT false,
    total_sales DECIMAL(15,2),
    seller_discount DECIMAL(15,2),
    final_shipping_fee DECIMAL(15,2),
    service_fee DECIMAL(15,2),
    escrow_amount TEXT,
    other_cost DECIMAL(15,2),
    package_count INTEGER DEFAULT 1,
    total_weight DECIMAL(10,2),
    package_organize_type TEXT,
    order_create_time TIMESTAMPTZ,
    order_update_time TIMESTAMPTZ,
    order_payment_time TIMESTAMPTZ,
    all_shipped BOOLEAN DEFAULT false,
    shipped_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    pre_order BOOLEAN DEFAULT false,
    tiktok_ndd BOOLEAN DEFAULT false,
    shopify_third_party BOOLEAN DEFAULT false,
    order_edit_times INTEGER DEFAULT 0
);

-- TABLE: order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_order_id TEXT,
    item_id TEXT,
    item_code TEXT,
    item_external_code TEXT,
    item_name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    original_price DECIMAL(15,2),
    sell_price DECIMAL(15,2),
    discount_amount DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    quantity INTEGER DEFAULT 1,
    return_quantity INTEGER DEFAULT 0,
    location_id TEXT,
    location_name TEXT,
    platform_warehouse_id TEXT,
    platform_warehouse_name TEXT,
    platform_warehouse_address TEXT,
    on_hand_stock DECIMAL(10,2),
    promotion_stock DECIMAL(10,2),
    tracking_number TEXT,
    courier TEXT,
    shipping_cost DECIMAL(15,2),
    package_id TEXT,
    is_shipped BOOLEAN DEFAULT false,
    order_status TEXT,
    platform_order_status TEXT,
    scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: shipments
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    tracking_number TEXT NOT NULL,
    courier TEXT,
    shipper TEXT,
    port_code TEXT,
    region_code TEXT,
    return_port_code TEXT,
    status TEXT DEFAULT 'pending',
    is_shipped BOOLEAN DEFAULT false,
    scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
    shipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: desty_sync_log
CREATE TABLE IF NOT EXISTS public.desty_sync_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sync_type TEXT NOT NULL,
    platform TEXT,
    orders_fetched INTEGER DEFAULT 0,
    orders_created INTEGER DEFAULT 0,
    orders_updated INTEGER DEFAULT 0,
    errors TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: desty_api_config
CREATE TABLE IF NOT EXISTS public.desty_api_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    access_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expire_time TIMESTAMPTZ,
    apply_id TEXT,
    company_name TEXT,
    company_email TEXT,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: daily_shipping_queue
CREATE TABLE IF NOT EXISTS public.daily_shipping_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    shipped_orders INTEGER DEFAULT 0,
    shipped_items INTEGER DEFAULT 0,
    pending_orders INTEGER DEFAULT 0,
    pending_items INTEGER DEFAULT 0,
    breakdown JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASE 2: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_scans_resi ON public.scans(resi);
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_date ON public.scans(scanned_date);
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_resi_status ON public.scans(resi, status);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date ON public.delivery_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_user_id ON public.delivery_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON public.orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_desty_id ON public.orders(desty_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_create_time ON public.orders(order_create_time);
CREATE INDEX IF NOT EXISTS idx_orders_shipped ON public.orders(all_shipped, order_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON public.order_items(item_code);
CREATE INDEX IF NOT EXISTS idx_order_items_tracking ON public.order_items(tracking_number);
CREATE INDEX IF NOT EXISTS idx_order_items_shipped ON public.order_items(is_shipped, order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON public.shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);

-- ============================================================
-- PHASE 3: ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desty_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desty_api_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_shipping_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PHASE 4: RLS POLICIES
-- ============================================================

-- scans policies
CREATE POLICY "scans_insert_policy" ON public.scans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "scans_select_policy" ON public.scans FOR SELECT TO authenticated USING (true);
CREATE POLICY "scans_update_policy" ON public.scans FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "scans_delete_policy" ON public.scans FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- user_roles policies
CREATE POLICY "user_roles_select_policy" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert_policy" ON public.user_roles FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "user_roles_update_policy" ON public.user_roles FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "user_roles_delete_policy" ON public.user_roles FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- delivery_notes policies
CREATE POLICY "delivery_notes_select_policy" ON public.delivery_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "delivery_notes_insert_policy" ON public.delivery_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delivery_notes_update_policy" ON public.delivery_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delivery_notes_delete_policy" ON public.delivery_notes FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- orders policies
CREATE POLICY "orders_select_policy" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_admin_insert_policy" ON public.orders FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "orders_admin_update_policy" ON public.orders FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "orders_admin_delete_policy" ON public.orders FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- order_items policies
CREATE POLICY "order_items_select_policy" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_admin_insert_policy" ON public.order_items FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "order_items_admin_update_policy" ON public.order_items FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "order_items_admin_delete_policy" ON public.order_items FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- shipments policies
CREATE POLICY "shipments_select_policy" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "shipments_insert_policy" ON public.shipments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shipments_admin_update_policy" ON public.shipments FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "shipments_admin_delete_policy" ON public.shipments FOR DELETE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- desty_sync_log policies
CREATE POLICY "desty_sync_log_select_policy" ON public.desty_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "desty_sync_log_admin_insert_policy" ON public.desty_sync_log FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- desty_api_config policies
CREATE POLICY "desty_api_config_select_policy" ON public.desty_api_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "desty_api_config_admin_insert_policy" ON public.desty_api_config FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "desty_api_config_admin_update_policy" ON public.desty_api_config FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- daily_shipping_queue policies
CREATE POLICY "daily_shipping_queue_select_policy" ON public.daily_shipping_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_shipping_queue_admin_insert_policy" ON public.daily_shipping_queue FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "daily_shipping_queue_admin_update_policy" ON public.daily_shipping_queue FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- ============================================================
-- PHASE 5: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create user_roles on auth.user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role, full_name)
    VALUES (NEW.id, 'staff', COALESCE(NEW.raw_user_meta_data->>'full_name', 'Staff Gudang'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Get unique users today
CREATE OR REPLACE FUNCTION public.get_unique_users_today(date_param DATE)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT s.user_id FROM public.scans s WHERE s.scanned_date = date_param;
END;
$$ LANGUAGE plpgsql;

-- Delete staff account
CREATE OR REPLACE FUNCTION public.delete_staff_account(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Hanya Admin yang bisa menghapus akun staf.';
    END IF;
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Tidak bisa menghapus akun sendiri.';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh daily shipping queue
CREATE OR REPLACE FUNCTION public.refresh_daily_shipping_queue(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
DECLARE
    total_o INTEGER; shipped_o INTEGER; pending_o INTEGER;
    total_i INTEGER; shipped_i INTEGER; pending_i INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_o FROM public.orders 
    WHERE order_status IN ('New_Orders', 'Ready_To_Ship', 'Shipping')
      AND DATE(order_create_time) <= target_date;
    
    SELECT COUNT(*) INTO shipped_o FROM public.orders 
    WHERE order_status IN ('Shipping', 'Completed') AND all_shipped = true
      AND DATE(order_create_time) <= target_date;
    
    pending_o := total_o - shipped_o;
    
    SELECT COUNT(*) INTO total_i FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_status IN ('New_Orders', 'Ready_To_Ship', 'Shipping')
      AND DATE(o.order_create_time) <= target_date;
    
    SELECT COUNT(*) INTO shipped_i FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.is_shipped = true AND DATE(o.order_create_time) <= target_date;
    
    pending_i := total_i - shipped_i;
    
    INSERT INTO public.daily_shipping_queue (date, total_orders, shipped_orders, pending_orders, total_items, shipped_items, pending_items)
    VALUES (target_date, total_o, shipped_o, pending_o, total_i, shipped_i, pending_i)
    ON CONFLICT (date) DO UPDATE SET 
        total_orders = EXCLUDED.total_orders,
        shipped_orders = EXCLUDED.shipped_orders,
        pending_orders = EXCLUDED.pending_orders,
        total_items = EXCLUDED.total_items,
        shipped_items = EXCLUDED.shipped_items,
        pending_items = EXCLUDED.pending_items,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PHASE 6: GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
