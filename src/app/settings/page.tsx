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
    
    if (action === "SCAN" && trackingNumber) {
      var trackingStr = String(trackingNumber).trim().toUpperCase();
      
      // Murni String ' tanpa konversi numeric oleh excel
      // Karena Supabase sudah memastikan ini 100% Unik Murni, kita tinggal lempar masuk saja (Lebih Cepat!)
      var lastRow = sheet.getLastRow();
      var emptyRow = lastRow + 1;
      
      sheet.getRange(emptyRow, colIndex).setValue("'" + trackingStr);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true, 
        row: emptyRow,
        scanned_at: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Ping OK' })).setMimeType(ContentService.MimeType.JSON);
    
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
        <button
          onClick={() => setShowTutorial(!showTutorial)}
          className="btn"
          style={{ width: 'auto', backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', color: 'white' }}
        >
          {showTutorial ? 'Sembunyikan' : '📖 Panduan Laporan Google Sheets'}
        </button>
      </div>

      {showTutorial && (
        <div style={{ padding: '20px', background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '24px', lineHeight: '1.6' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '12px' }}>Cara Mengirim Tembusan ke Google Sheet (Pasif)</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
            Karena pendeteksi Duplikat sudah diambil alih oleh PostgreSQL secara penuh, Google Sheets kini hanya bertindak sebagai "Penerima Laporan" murni. Jadinya akan 100X lebih cepat dari sebelumnya.
          </p>
          <ol style={{ marginLeft: '20px', color: 'var(--text-main)' }}>
            <li style={{ marginBottom: '8px' }}>Buka file Google Sheet Anda &gt; menu <strong>Extensions (Ekstensi)</strong> &gt; <strong>Apps Script</strong>.</li>
            <li style={{ marginBottom: '8px' }}>Hapus semua kode lama, lalu <strong>paste kode super-ngebut ini</strong>:</li>

            <div style={{ position: 'relative', margin: '12px 0' }}>
              <pre style={{ background: '#000', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                <code>{scriptCode}</code>
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(scriptCode).then(() => alert('Kode berhasil disalin!'))}
                style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', fontSize: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Salin Kode Baru
              </button>
            </div>

            <li style={{ marginBottom: '8px' }}>Deploy ulang sebagai Web App (Pilih "Me" dan "Anyone"). Salin URL-nya ke bawah ini.</li>
          </ol>
        </div>
      )}

      {message && <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px' }}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px', background: 'rgba(46, 160, 67, 0.1)', border: '1px solid var(--success)' }}>
          <h3 style={{ color: 'var(--success)', marginBottom: '8px' }}>🚀 Terhubung ke Master Database Supabase</h3>
          <p style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5' }}>
            Pencegahan Duplikat ditangani level basis data (0.01 Detik). Bebas Vercel Reset Timeout.
          </p>
        </div>

        <div className="form-group" style={{ padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          <h4 style={{ marginBottom: '16px', color: 'var(--primary)' }}>Tembusan Pasif (Opsional)</h4>
          <label className="form-label">URL Laporan Tembusan Google Sheets</label>
          <input className="form-control" type="url" value={config.scriptWebUrl} onChange={(e) => setConfig({ ...config, scriptWebUrl: e.target.value })} placeholder="Cth: https://script.google.com/macros/s/AKfycby.../exec" />
          <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>Jika diisi, setelah Supabase memastikan resi aman, akan langsung di-_copy_ ke mari.</small>

          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Nama Sheet</label>
              <input className="form-control" type="text" value={config.sheetName} onChange={(e) => setConfig({ ...config, sheetName: e.target.value })} placeholder="Cth: Laporan" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Kolom Target</label>
              <input className="form-control" type="text" value={config.targetColumn} onChange={(e) => setConfig({ ...config, targetColumn: e.target.value })} placeholder="Cth: A" />
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '24px' }}>
          <label className="form-label">Target Pengiriman (Packing) Harian</label>
          <input className="form-control" type="number" value={config.dailyTarget} onChange={(e) => setConfig({ ...config, dailyTarget: Number(e.target.value) })} min="1" />
          <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>Membantu mengukur sisa pengiriman resi hari ini di halaman awal Scanner Anda.</small>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>Simpan Target Berjalan</button>
      </form>

      <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Zona Berbahaya</h3>
        <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>Menghapus seluruh rekaman resi pada hari ini di Data Server Utama Supabase (Ke Excel tidak akan terhapus).</p>
        <button onClick={resetDaily} className="btn btn-danger">🗑 Hapus Seluruh Riwayat Hari Ini</button>
      </div>
    </div>
  );
}
