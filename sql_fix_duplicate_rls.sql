-- MENGHANCURKAN BUG RLS PADA PENGECEKAN DUPLIKAT STAF
-- Menghapus RLS lama yang terlalu ketat
DROP POLICY IF EXISTS "Membaca data scan sesuai role" ON public.scans;
DROP POLICY IF EXISTS "Membaca data scan gudang" ON public.scans;

-- Mengganti RLS agar Staf Lapangan BISA saling melihat resi siapa yang nyangkut, 
-- sehingga sistem UI (Frontend) tidak tertipu (nge-blind) saat melakukan cek Duplikat.
CREATE POLICY "Membaca data scan gudang bersama" 
ON public.scans FOR SELECT 
TO authenticated 
USING (true);
