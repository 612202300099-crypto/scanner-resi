-- ==============================================================================
-- 🚀 SKEMA DATABASE BERITA ACARA (DELIVERY NOTES)
-- ==============================================================================

-- 1. Buat Tabel (Jika belum ada)
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  note_date date NOT NULL,
  sender_name text NOT NULL,
  sender_address text NOT NULL,
  expedition text NOT NULL,
  courier_name text,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_name text NOT NULL
);

-- UPDATE V2: Menambahkan kolom penampungan gambar base64
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS photo_data text;

-- UPDATE V3: Fitur edit + lock + photo source tracking
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS is_finalized boolean DEFAULT false;
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS photo_source text DEFAULT 'camera';
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Optimasi Pencarian
CREATE INDEX IF NOT EXISTS idx_delivery_notes_date ON public.delivery_notes (note_date);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_created ON public.delivery_notes (created_at DESC);

-- 3. Kebijakan Keamanan RLS (Bug-Free)
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

-- Drop Policy lama jika butuh replace utuh (Opsional untuk clean update)
DROP POLICY IF EXISTS "Membaca berita acara sesuai role" ON public.delivery_notes;
DROP POLICY IF EXISTS "Bisa nambah berita acara" ON public.delivery_notes;
DROP POLICY IF EXISTS "Admin bisa edit berita acara" ON public.delivery_notes;
DROP POLICY IF EXISTS "Admin bisa hapus riwayat" ON public.delivery_notes;

-- Admin bisa melihat semua Berita Acara, Staf hanya lihat miliknya sendiri
CREATE POLICY "Membaca berita acara sesuai role" 
ON public.delivery_notes FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- Siapapun staf yang login bisa membuat Berita Acara
CREATE POLICY "Bisa nambah berita acara" 
ON public.delivery_notes FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- HANYA Admin yang berhak memodifikasi, walau staf seringkali tak perlu
-- PERUBAHAN: Tidak bisa edit jika sudah di-finalize
CREATE POLICY "Admin bisa edit berita acara" 
ON public.delivery_notes FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  AND NOT is_finalized
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  AND NOT is_finalized
);

-- HANYA Admin yang berhak menghapus berkas arsip salah
CREATE POLICY "Admin bisa hapus riwayat" 
ON public.delivery_notes FOR DELETE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Notifikasi perbaruan schema untuk API 
NOTIFY pgrst, 'reload schema';
