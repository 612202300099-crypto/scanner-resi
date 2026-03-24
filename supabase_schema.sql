-- ==============================================================================
-- 🚀 SKEMA DATABASE LEVEL ENTERPRISE (V3.1 - FIX INFINITE RECURSION RLS)
-- ==============================================================================

-- 1. Bersihkan Tabel Lama secara Aman
DROP TABLE IF EXISTS public.scans CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- ==========================================
-- 2. TABEL ROLE (SUPER ADMIN TERPUSAT)
-- ==========================================
CREATE TABLE public.user_roles (
  user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'staff')),
  full_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 3. TABEL RESI (MENDUKUNG STATUS ALUR)
-- ==========================================
CREATE TABLE public.scans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resi text NOT NULL,
  status text NOT NULL CHECK (status IN ('MASUK', 'KELUAR', 'RETUR')),
  scanned_at timestamp with time zone NOT NULL,
  scanned_date date NOT NULL,
  scanned_time time without time zone NOT NULL,
  scanned_day text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  UNIQUE(resi, status)
);

CREATE INDEX idx_scans_date ON public.scans (scanned_date);
CREATE INDEX idx_scans_status ON public.scans (status);

-- ==========================================
-- 4. TRIGGER OTOMATIS: SISTEM "KAISAR PERTAMA"
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  role_count INT;
  assigned_role TEXT;
BEGIN
  SELECT count(*) INTO role_count FROM public.user_roles;
  
  IF role_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'staff';
  END IF;

  INSERT INTO public.user_roles (user_id, role, full_name)
  VALUES (new.id, assigned_role, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 5. KEAMANAN RLS TANPA REKURSIF ( BUG-FREE )
-- ==========================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- KUNCI UTAMA: Agar sistem tidak error melingkar (Infinite Recursion),
-- Kebijakan membaca tabel ROLE bebas diakses (selama staf sudah login). 
-- Privasi staf terjaga karena mereka tidak bisa mengubahnya, hanya bisa membaca siapa adminnya.
CREATE POLICY "Semua Staf bisa lihat list role" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (true);

-- Hanya ADMIN murni yang bisa mutasi jabatan/role
CREATE POLICY "Admin bisa mutasi jabatan"
ON public.user_roles FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Admin bisa lihat semua resi, staf HANYA lihat resinya sendiri
CREATE POLICY "Membaca data scan sesuai role" 
ON public.scans FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- Siapapun staf yang login bisa nambah resi
CREATE POLICY "Bisa nambah scan resi" 
ON public.scans FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Admin bisa ngedit resi orang jika typo
CREATE POLICY "Admin bisa edit resi (Typo/Status)" 
ON public.scans FOR UPDATE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Admin bisa menghapus sampah ketikan
CREATE POLICY "Admin bisa hapus riwayat" 
ON public.scans FOR DELETE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE OR REPLACE FUNCTION get_unique_users_today(date_param date)
RETURNS TABLE(user_id uuid) AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT scans.user_id 
  FROM public.scans 
  WHERE scanned_date = date_param AND scans.user_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';

-- ==========================================
-- 6. PENYELAMATAN DATA LAMA + SINKRONISASI PENGUASA MUTLAK BUMI
-- ==========================================
INSERT INTO public.user_roles (user_id, role, full_name, created_at)
SELECT 
    id, 
    CASE WHEN ROW_NUMBER() OVER (ORDER BY created_at ASC) = 1 THEN 'admin' ELSE 'staff' END as role,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    created_at
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
