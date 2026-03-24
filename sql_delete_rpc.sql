-- Fungsi Hapus Master (Delete Akun dari Supabase Auth secara paksa) dari Frontend
-- Fungsi ini akan membunuh Data Staf dari tabel `user_roles` DAN membunuh Akun Login dari `auth.users`
-- Namun tetap BISA membiarkan Riwayat Scannya tetap utuh berkat ON DELETE SET NULL.

CREATE OR REPLACE FUNCTION public.delete_staff_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Menjalankan fungsi ini dengan hak akses SUPERUSER / Admin Database
AS $$
BEGIN
  -- 1. Verifikasi Keamanan: Apakah yang memanggil fungsi ini benar-benar ADMIN?
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Akses Ilegal: Hanya Administrator yang berhak membunuh akun.';
  END IF;

  -- 2. Hapus referensi dari user_roles (Supaya FK Constraint aman)
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  -- 3. Hapus referensi dari scans agar menjadi NULL (Supaya Riwayat Scan tetap hijau/bersih, 
  --    namun tidak error karena pemilik aslinya kita musnahkan)
  --    Kita hanya mengubah UID-nya jadi NULL, tapi "user_name" (Nama Teks)-nya tetap ada sebagai barang bukti!
  UPDATE public.scans SET user_id = NULL WHERE user_id = target_user_id;

  -- 4. EKSEKUSI PEMBUNUHAN AKUN DI SISTEM OTENTIKASI (Hancurkan Email & Passwordnya)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
