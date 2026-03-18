'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getClientConfig } from '@/lib/clientStorage';

// Import scanner dinamis agar tidak load di SSR Next.js
const ScannerComponent = dynamic(() => import('@/components/ScannerComponent'), {
  ssr: false,
});

export default function Home() {
  const [stats, setStats] = useState({ totalScannedToday: 0, target: 100, lastScanned: null as any, recentHistory: [] as any[] });
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning', message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualResi, setManualResi] = useState('');
  const [flashType, setFlashType] = useState<'success' | 'error' | null>(null);

  const lastScanTimeRef = useRef(0);
  const lastScannedTextRef = useRef('');

  const fetchStats = async () => {
    try {
      const activeConfig = getClientConfig();
      if (!activeConfig.scriptWebUrl) return; // Jangan panggil kalau belum disetup

      const res = await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: activeConfig })
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const triggerVisualFeedback = (type: 'success' | 'error') => {
    setFlashType(type);

    // Getar HP jika API didukung (sukses 100ms, error getar panjang 300ms)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? 100 : [200, 100, 200]);
    }

    setTimeout(() => setFlashType(null), 600); // Hapus class flash setelah animasi 0.6s
  };

  const playSound = (type: 'success' | 'duplicate' | 'error') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'duplicate') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) { }
  };

  const processBarcode = async (decodedText: string) => {
    if (isProcessing || !decodedText.trim()) return;

    setIsProcessing(true);

    try {
      const activeConfig = getClientConfig();
      if (!activeConfig.scriptWebUrl) {
        setAlert({ type: 'danger', message: '❌ Lengkapi URL Pengaturan dulu!' });
        setIsProcessing(false);
        return;
      }

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_number: decodedText, config: activeConfig }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAlert({ type: 'success', message: `✅ Resi ${decodedText} berhasil disimpan.` });
        playSound('success');
        triggerVisualFeedback('success');
      } else if (res.status === 409) {
        setAlert({ type: 'warning', message: `⚠️ Resi ${decodedText} sudah pernah discan hari ini.` });
        playSound('duplicate');
        triggerVisualFeedback('error');
      } else {
        setAlert({ type: 'danger', message: `❌ ${data.error || 'Terjadi kesalahan sistem'}` });
        playSound('error');
        triggerVisualFeedback('error');
      }

    } catch (error) {
      console.error(error);
      setAlert({ type: 'danger', message: '❌ Koneksi terputus. Pastikan internet lancar.' });
      playSound('error');
      triggerVisualFeedback('error');
    } finally {
      setIsProcessing(false);
      setManualResi(''); // Kosongkan form manual setelah enter
      fetchStats();
      setTimeout(() => setAlert(null), 4000);
    }
  };

  const handleScan = async (decodedText: string) => {
    const now = Date.now();
    // Debounce kamera 3 detik
    if (decodedText === lastScannedTextRef.current && (now - lastScanTimeRef.current < 3000)) {
      return;
    }
    lastScannedTextRef.current = decodedText;
    lastScanTimeRef.current = now;

    await processBarcode(decodedText);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bypass kamera debounce untuk ketik manual
    await processBarcode(manualResi);
  };

  const onScanRef = useRef(handleScan);
  useEffect(() => {
    onScanRef.current = handleScan;
  }, [handleScan]);

  // Efek flash ditambahkan ke body document (agar seluruh halaman berkedip)
  useEffect(() => {
    if (flashType === 'success') {
      document.body.classList.add('screen-flash-success');
    } else if (flashType === 'error') {
      document.body.classList.add('screen-flash-error');
    }

    return () => {
      document.body.classList.remove('screen-flash-success', 'screen-flash-error');
    };
  }, [flashType]);

  const sisa = Math.max(0, stats.target - stats.totalScannedToday);

  return (
    <>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Total Discan Hari Ini</div>
          <div className="stat-value highlight">{stats.totalScannedToday}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Sisa Target</div>
          <div className="stat-value">{sisa}</div>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.type === 'success' ? '✅' : alert.type === 'warning' ? '⚠️' : '❌'} {alert.message}
        </div>
      )}

      <div className="card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '16px' }}>Scan Resi Camera</h2>
        <ScannerComponent onScan={(text) => onScanRef.current(text)} />
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Arahkan barcode resi ke kamera untuk otomatis memindai.</p>

        <form onSubmit={handleManualSubmit} style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          <label className="form-label" style={{ textAlign: 'left' }}>Ketik Manual (Jika stiker rusak):</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Ketik angka resi lalu Enter..."
              value={manualResi}
              onChange={(e) => setManualResi(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 24px' }} disabled={isProcessing}>
              Kirim
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Riwayat Terakhir</h3>
        <div className="history-list">
          {stats.recentHistory?.length > 0 ? (
            stats.recentHistory.map((item, idx) => (
              <div key={idx} className={`history-item ${item.status}`}>
                <div>
                  <strong>{item.tracking_number}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(item.scanned_at).toLocaleTimeString('id-ID')}
                  </span>
                  <span className={`badge badge-${item.status === 'success' ? 'success' : 'warning'}`}>
                    {item.status === 'success' ? 'Otomatis Masuk' : 'Tertolak / Duplikat'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada resi discan hari ini.</div>
          )}
        </div>
      </div>
    </>
  );
}
