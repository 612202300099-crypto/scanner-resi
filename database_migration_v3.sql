-- =====================================================
-- Database Migration v3 - Gallery & Finalize Support
-- =====================================================
-- Menambahkan support untuk:
-- 1. Photo source tracking (camera vs gallery)
-- 2. Finalize/Lock functionality
-- 3. Updated timestamp

-- Alter table untuk menambah columns baru
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS is_finalized boolean DEFAULT false;
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS photo_source text DEFAULT 'camera' CHECK (photo_source IN ('camera', 'gallery'));
ALTER TABLE public.delivery_notes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Update RLS Policy untuk check is_finalized status
DROP POLICY IF EXISTS "Admin bisa edit berita acara" ON public.delivery_notes;

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

-- Index untuk faster finalized queries
CREATE INDEX IF NOT EXISTS idx_delivery_notes_finalized ON public.delivery_notes (is_finalized, created_at DESC);

-- Notification
NOTIFY pgrst, 'reload schema';
