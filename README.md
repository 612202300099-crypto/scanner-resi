# Dokumentasi Sistem Scanner Resi

Aplikasi web ini dirancang untuk pemindaian resi barcode secara cepat dengan integrasi langsung ke Google Sheets **tanpa biaya, tanpa database rumit, dan tanpa setup Google Cloud Console yang menyulitkan**.

Sistem mencegah entri ganda (duplicate scans) dan memiliki antarmuka operasional yang mudah digunakan (100% Bahasa Indonesia).

## 1. Arsitektur Sistem

Aplikasi ini menggunakan pola **Monolith Serverless** dengan framework:
- **Frontend**: React.js / Next.js. Menangani tampilan antarmuka pemindaian (kamera perangkat) menggunakan pustaka `html5-qrcode`. Memberikan umpan balik suara dan visual secara instan per scan.
- **Backend (API)**: Next.js Route Handlers (`/app/api`). Menerima data hasil scan, memvalidasi duplikat, dan **berkomunikasi langsung ke Google Sheets menggunakan Webhook (Google Apps Script).**
- **Penyimpanan (Storage) Internal**: 
  - Flat JSON File: Menyimpan data resi sementara (untuk validasi duplikat hari ini) dan konfigurasi Google Sheets secara persisten di folder `data/` milik server agar data tidak hilang ketika server di-restart.

## 2. Skema Basis Data

### A. Tabel/Koleksi Resi Lokal (`scanned_items` - JSON)
Menyimpan riwayat barcode yang telah di-scan.
```json
{
  "id": "uuid-string",
  "tracking_number": "RESI123456789",
  "scanned_at": "2026-03-17T12:00:00.000Z",
  "status": "success"
}
```

### B. Konfigurasi Sistem (`config` - JSON)
```json
{
  "scriptWebUrl": "https://script.google.com/macros/s/AKfyc.../exec",
  "sheetName": "Laporan",
  "targetColumn": "A",
  "dailyTarget": 100
}
```

## 3. Desain API Backend

Sistem mengekspos REST API internal berikut:

### `POST /api/scan`
Menerima scan kamera, memvalidasi duplikat dalam memori hari ini, dan **meneruskannya ke Webhook Google Apps Script.**
- **Response (200 OK)**: `{"success": true, "message": "Resi berhasil ditambahkan."}`
- **Response (409 Conflict)**: `{"success": false, "error": "Resi sudah pernah discan."}`

### `GET /api/stats`
Mengambil kalkulasi scan (total, sisa target, log terakhir).

### `POST /api/config`
Memperbarui konfigurasi sistem (Web URL Apps Script, dsb).

### `DELETE /api/reset`
Menghapus riwayat scan hari ini, memungkinkan sistem di-_restart_ manual jika gudang reset shift.

---

## 4. Panduan Setup *Google Sheets* Super Cepat (Tanpa API Key, Tanpa Google Cloud)

Kami menggunakan fitur bawaan **Google Apps Script** untuk membuat Webhook (Titik URL) yang **sangat powerful, gratis, jangka panjang, dan bebas dari pembatasan Google Cloud Oauth**. Tidak ada kunci `.json` yang bisa hilang/bocor.

1. Buka file Google Sheet yang ingin Anda pakai.
2. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
3. Hapus semua kode bawaan, lalu **paste kode JavaScript berikut**:
   ```js
   function doPost(e) {
     try {
       var data = JSON.parse(e.postData.contents);
       var trackingNumber = data.tracking_number;
       var sheetName = data.sheetName || 'Sheet1';
       var targetColumn = data.targetColumn || 'A';
       
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       var sheet = ss.getSheetByName(sheetName);
       if (!sheet) { sheet = ss.insertSheet(sheetName); }
       
       var colIndex = 0; targetColumn = targetColumn.toUpperCase();
       for (var i = 0; i < targetColumn.length; i++) {
           colIndex += (targetColumn.charCodeAt(i) - 64) * Math.pow(26, targetColumn.length - i - 1);
       }
       
       var values = sheet.getRange(1, colIndex, sheet.getMaxRows(), 1).getValues();
       var nextRow = 1;
       for (var i = values.length - 1; i >= 0; i--) {
         if (values[i][0] !== "") { nextRow = i + 2; break; }
       }
       
       sheet.getRange(nextRow, colIndex).setValue(trackingNumber);
       return ContentService.createTextOutput(JSON.stringify({ "success": true, "row": nextRow })).setMimeType(ContentService.MimeType.JSON);
     } catch (error) {
       return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": error.toString() })).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
4. Klik ikon **Save** (Simpan) di toolbar.
5. Di pojok kanan atas, klik tombol biru **Deploy** > **New deployment**.
6. Pilih _Select type_ (ikon Roda Gigi): centang **Web app**.
7. **PENTING**: Pada bagian **Who has access**, ubah menjadi **"Anyone" (Siapa saja)**.
8. Klik **Deploy**. (Jika muncul tab keamanan: _Review permissions_ > pilih Gmail > klik opsi _Advanced_ terbawah > _Go to Project (unsafe)_ > Allow).
9. **Selesai!** Salin **Web app URL** yang muncul.
10. Masuk ke aplikasi ini (Aplikasi Scanner Gudang), buka menu **Pengaturan**, dan Paste Web app URL tersebut.

*Catatan: Semua data yang dihantam ke URL ini otomatis nyambung ke Spreadsheet Anda secepat kilat (server-to-server) tanpa batasan API GCP.*

---

## 5. Panduan Deployment (VPS Server Gudang)

Cocok jika beroperasi di jaringan tertutup di warehouse atau menggunakan server lokal. File JSON riwayat akan berjalan aman di server internal Gudang.

1. Install Node.js v18+.
2. Salin seluruh proyek ke dalam VPS.
3. Jalankan `npm install`
4. Jalankan `npm run build`
5. Gunakan utilitas seperti PM2 untuk Production:  
   `npm install -g pm2`  
   `pm2 start npm --name "scanner-resi" -- run start`
