-- ==============================================================================
-- 🚀 SKEMA DATABASE BERITA ACARA (DELIVERY NOTES)
-- ==============================================================================

-- 1. Buat Tabel
CREATE TABLE public.delivery_notes (
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

-- 2. Optimasi Pencarian
CREATE INDEX idx_delivery_notes_date ON public.delivery_notes (note_date);
CREATE INDEX idx_delivery_notes_created ON public.delivery_notes (created_at DESC);

-- 3. Kebijakan Keamanan RLS (Bug-Free)
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Admin bisa edit berita acara" 
ON public.delivery_notes FOR UPDATE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- HANYA Admin yang berhak menghapus berkas arsip salah
CREATE POLICY "Admin bisa hapus riwayat" 
ON public.delivery_notes FOR DELETE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Notifikasi perbaruan schema untuk API 
NOTIFY pgrst, 'reload schema';
