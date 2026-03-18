'use client';

import { useState, useEffect } from 'react';
import { getClientConfig, saveClientConfig } from '@/lib/clientStorage';

export default function Settings() {
    const [config, setConfig] = useState({
        scriptWebUrl: '',
        sheetName: '',
        targetColumn: 'A',
        dailyTarget: 100
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        // Bebas akses memori HP tanpa takut Vercel Reset
        const local = getClientConfig();
        setConfig(local);
        setLoading(false);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('Menyimpan ke memori perangkat...');
        if (config.scriptWebUrl && !config.scriptWebUrl.startsWith('https://script.google.com/')) {
            setMessage('❌ Format URL tidak valid. Harus berawalan https://script.google.com/');
            return;
        }
        try {
            saveClientConfig(config);
            setMessage('✅ URL berhasil disimpan secara permanen di alat ini!');
            // Panggil backend dummy (opsional, jika ingin nyimpen local codebase, tp skip gpp)
            setTimeout(() => setMessage(''), 3000);
        } catch (e) {
            setMessage('❌ Gagal menyimpn konfigurasi lokal');
        }
    };

    const resetDaily = async () => {
        if (confirm('Apakah Anda yakin ingin menghapus seluruh rekaman resi hari ini?')) {
            const res = await fetch('/api/reset', { method: 'DELETE' });
            if (res.ok) {
                alert('Data berhasil di-reset!');
            }
        }
    };

    const scriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action; 
    var trackingNumber = data.tracking_number;
    var sheetName = data.sheetName || 'Sheet1';
    var targetColumn = data.targetColumn || 'A';
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Konversi A->1, Z->26, AA->27
    var colIndex = 0;
    targetColumn = targetColumn.toUpperCase();
    for (var i = 0; i < targetColumn.length; i++) {
        colIndex += (targetColumn.charCodeAt(i) - 64) * Math.pow(26, targetColumn.length - i - 1);
    }
    
    // BACA SELURUH ISI KOLOM secara cepat
    var values = sheet.getRange(1, colIndex, sheet.getMaxRows(), 1).getDisplayValues();
    var allScans = [];
    var nextRow = 1;
    
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] !== "") {
        // PERBAIKAN FATAL: Memaksa semua resi (nomor/teks) di Sheet menjadi String murni agar aman dicek
        allScans.push(String(values[i][0]).trim().toUpperCase());
        nextRow = i + 2;
      }
    }
    
    if (action === "GET_STATS") {
      var recent = allScans.slice(-6).reverse().map(function(t) { 
        return { tracking_number: t, status: 'success', scanned_at: new Date().toISOString() };
      });
      return ContentService.createTextOutput(JSON.stringify({
        success: true, 
        total: allScans.length, 
        recentHistory: recent
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (trackingNumber) {
      var trackingStr = String(trackingNumber).trim().toUpperCase();
      
      // PENCEGAHAN DUPLIKAT ABSOLUT SEKARANG TERJAMIN:
      if (allScans.indexOf(trackingStr) !== -1) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false, 
          is_duplicate: true, 
          error: "Tertolak! Resi sudah tercatat di Google Sheet."
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Murni String ' tanpa konversi numeric oleh excel
      sheet.getRange(nextRow, colIndex).setValue("'" + trackingStr);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true, 
        row: nextRow,
        scanned_at: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Aksi tidak dikenali.");
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: String(error)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    if (loading) return <div>Memuat konfigurasi...</div>;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>⚙️ Pengaturan Aplikasi Gudang</h2>
            </div>
            {message && <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px' }}>{message}</div>}

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(46, 160, 67, 0.1)', border: '1px solid var(--success)' }}>
                    <h3 style={{ color: 'var(--success)', marginBottom: '8px' }}>🚀 Terhubung ke Master Database Premium</h3>
                    <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5' }}>
                        Aplikasi saat ini sudah terhubung secara realtime penuh (Tanpa Jeda) menggunakan <strong>Database Serverless Murni PostgreSQL</strong>. Perlindungan Duplikasi Absolut telah diaktifkan di level basis data. Staf tidak memakan waktu loading excel lagi.
                    </p>
                </div>

                <div className="form-group">
                    <label className="form-label">Target Pengiriman (Packing) Harian</label>
                    <input className="form-control" type="number" value={config.dailyTarget} onChange={(e) => setConfig({ ...config, dailyTarget: Number(e.target.value) })} min="1" />
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>Membantu mengukur sisa pengiriman resi hari ini di halaman awal Scanner Anda.</small>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>Simpan Target Berjalan</button>
            </form>

            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Zona Berbahaya</h3>
                <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>Menghapus seluruh rekaman resi pada hari ini di Data Server Utama. Jika dihapus, Anda/Staff Gudang bisa melakukan "scan ulang" resi hari ini.</p>
                <button onClick={resetDaily} className="btn btn-danger">🗑 Hapus Seluruh Riwayat Hari Ini</button>
            </div>
        </div>
    );
}
