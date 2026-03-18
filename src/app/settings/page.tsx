'use client';

import { useState, useEffect } from 'react';

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
        fetch('/api/config')
            .then((res) => res.json())
            .then((data) => {
                setConfig(data);
                setLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('Menyimpan...');
        if (config.scriptWebUrl && !config.scriptWebUrl.startsWith('https://script.google.com/')) {
            setMessage('❌ Format URL tidak valid. Harus berawalan https://script.google.com/');
            return;
        }
        try {
            const result = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await result.json();
            if (data.success) {
                setMessage('✅ Konfigurasi berhasil disimpan!');
                setTimeout(() => setMessage(''), 3000);
            }
        } catch (e) {
            setMessage('❌ Gagal menyimpan konfigurasi');
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
    var trackingNumber = data.tracking_number;
    var sheetName = data.sheetName || 'Sheet1';
    var targetColumn = data.targetColumn || 'A';
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    // Auto-create jika sheet tidak ada!
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Konversi A->1, Z->26, AA->27 
    var colIndex = 0;
    targetColumn = targetColumn.toUpperCase();
    for (var i = 0; i < targetColumn.length; i++) {
        colIndex += (targetColumn.charCodeAt(i) - 64) * Math.pow(26, targetColumn.length - i - 1);
    }
    
    // Cari baris terakhir yang terisi (Super Aman)
    var values = sheet.getRange(1, colIndex, sheet.getMaxRows(), 1).getValues();
    var nextRow = 1;
    for (var i = values.length - 1; i >= 0; i--) {
      if (values[i][0] !== "") {
        nextRow = i + 2;
        break;
      }
    }
    
    sheet.getRange(nextRow, colIndex).setValue(trackingNumber);
    
    return ContentService.createTextOutput(JSON.stringify({
      "success": true, "row": nextRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "success": false, "error": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    if (loading) return <div>Memuat konfigurasi...</div>;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>⚙️ Pengaturan Integrasi</h2>
                <button
                    onClick={() => setShowTutorial(!showTutorial)}
                    className="btn"
                    style={{ width: 'auto', backgroundColor: 'var(--panel-bg)', border: '1px solid var(--border-color)', color: 'white' }}
                >
                    {showTutorial ? 'Tutup Panduan' : '📖 Panduan Google Web App'}
                </button>
            </div>

            {showTutorial && (
                <div style={{ padding: '20px', background: '#0d1117', border: '1px solid var(--primary)', borderRadius: '8px', marginBottom: '24px', lineHeight: '1.6' }}>
                    <h3 style={{ color: 'var(--primary)', marginBottom: '12px' }}>Cara Menghubungkan Google Sheet Super Mudah</h3>
                    <ol style={{ marginLeft: '20px', color: 'var(--text-main)' }}>
                        <li style={{ marginBottom: '8px' }}>Buka file Google Sheet yang ingin Anda pakai</li>
                        <li style={{ marginBottom: '8px' }}>Klik menu <strong>Extensions (Ekstensi)</strong> &gt; <strong>Apps Script</strong>.</li>
                        <li style={{ marginBottom: '8px' }}>Hapus semua kode bawaan, lalu <strong>paste salinan kode di bawah ini</strong>:</li>

                        <div style={{ position: 'relative', margin: '12px 0' }}>
                            <pre style={{ background: '#000', padding: '16px', borderRadius: '4px', overflowX: 'auto', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                                <code>{scriptCode}</code>
                            </pre>
                            <button
                                onClick={() => navigator.clipboard.writeText(scriptCode).then(() => alert('Kode berhasil disalin!'))}
                                style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', fontSize: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Salin Kode
                            </button>
                        </div>

                        <li style={{ marginBottom: '8px' }}>Klik ikon Save (Disket/Simpan) di toolbar.</li>
                        <li style={{ marginBottom: '8px' }}>Di pojok kanan atas, klik tombol biru <strong>Deploy (Terapkan)</strong> &gt; <strong>New deployment (Penerapan Baru)</strong>.</li>
                        <li style={{ marginBottom: '8px' }}>Di ikon roda gigi kecil (Select type), centang <strong>Web app</strong>.</li>
                        <li style={{ marginBottom: '8px' }}>Penting ke-1: Pada bagian <strong>Execute as (Jalankan sebagai)</strong>, pilih <strong>"Me"</strong> (email Anda sendiri).</li>
                        <li style={{ marginBottom: '12px' }}>Penting ke-2: Pada bagian <strong>Who has access (Siapa yang memiliki akses)</strong>, pilih <strong>"Anyone" (Siapa saja)</strong>, lalu klik <strong>Deploy</strong>. <em>Jangan pilih yang ada tulisan organizaton/domain Anda!</em></li>
                        <li style={{ marginBottom: '8px' }}>Jika muncul peringatan keamanan, klik <strong>Review permissions</strong> &gt; Pilih akun Google &gt; klik <strong>Advanced</strong> &gt; Go to Project (unsafe) &gt; Allow.</li>
                        <li style={{ marginBottom: '8px' }}>Salin <strong>Web app URL</strong> yang muncul, lalu <strong>Paste URL tersebut ke dalam kolom di bawah ini.</strong></li>
                    </ol>
                </div>
            )}

            {message && <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px' }}>{message}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">URL Web App (Google Apps Script)</label>
                    <input className="form-control" type="url" value={config.scriptWebUrl} onChange={(e) => setConfig({ ...config, scriptWebUrl: e.target.value })} placeholder="Cth: https://script.google.com/macros/s/AKfycby.../exec" required />
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>Tanpa setting Google Cloud sama sekali, tempel URL Web App "Deploy" dari Apps Script Anda ke sini.</small>
                </div>

                <div className="form-group">
                    <label className="form-label">Nama Sheet di Dalam Spreadsheet</label>
                    <input className="form-control" type="text" value={config.sheetName} onChange={(e) => setConfig({ ...config, sheetName: e.target.value })} placeholder="Cth: Laporan" required />
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--text-muted)' }}>Pastikan sesuai dengan nama tab (Sheet) yang ada di bawah file Anda, (contoh: Sheet1).</small>
                </div>

                <div className="form-group">
                    <label className="form-label">Kolom Target (Huruf)</label>
                    <input className="form-control" type="text" value={config.targetColumn} onChange={(e) => setConfig({ ...config, targetColumn: e.target.value })} placeholder="Cth: A" required />
                </div>

                <div className="form-group">
                    <label className="form-label">Target Pengiriman Harian (Opsional)</label>
                    <input className="form-control" type="number" value={config.dailyTarget} onChange={(e) => setConfig({ ...config, dailyTarget: Number(e.target.value) })} min="1" />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>Simpan Pengaturan Integrasi</button>
            </form>

            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <h3 style={{ color: 'var(--danger)', marginBottom: '16px' }}>Zona Berbahaya</h3>
                <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>Menghapus seluruh rekaman resi pada hari ini. Jika dihapus, Anda/Staff Gudang bisa melakukan "scan ulang" resi yang divalidasi ke dalam Sheet.</p>
                <button onClick={resetDaily} className="btn btn-danger">🗑 Hapus Riwayat Deteksi Duplikat Hari Ini</button>
            </div>
        </div>
    );
}
