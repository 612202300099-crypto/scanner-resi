/**
 * DestySettings — Konfigurasi Desty Omni (Auto-Sync via Cron)
 */
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';

export default function DestySettings() {
  return (
    <div>
      <h1 className="page-title">⚙️ Konfigurasi Desty Omni</h1>

      <div className="card" style={{ marginBottom: '1.5rem', borderTop: '4px solid var(--success)', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle2 size={32} color="#16a34a" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#166534' }}>Auto-Sync Aktif</h2>
            <p style={{ margin: '0.25rem 0 0', color: '#15803d', fontSize: '0.9rem' }}>
              Data order otomatis tersinkronisasi dari Desty Omni ke Supabase setiap 2 menit melalui cron job.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} /> Jadwal Sinkronisasi
        </h3>
        <table style={{ width: '100%', marginTop: '0.5rem' }}>
          <tbody>
            <tr><td style={{ padding: '0.5rem', fontWeight: 700 }}>Frekuensi</td><td>Setiap 2 menit</td></tr>
            <tr><td style={{ padding: '0.5rem', fontWeight: 700 }}>Sumber</td><td>omni.desty.app/api/order-center</td></tr>
            <tr><td style={{ padding: '0.5rem', fontWeight: 700 }}>Target</td><td>Supabase Production (zervdttmbpenbujkjcrn)</td></tr>
            <tr><td style={{ padding: '0.5rem', fontWeight: 700 }}>Data</td><td>Order Processed (Telah Diproses) + items + resi</td></tr>
            <tr><td style={{ padding: '0.5rem', fontWeight: 700 }}>Status</td><td><span style={{ color: 'var(--success)', fontWeight: 700 }}>● Running</span> (Windows Task Scheduler)</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} /> Cara Kerja
        </h3>
        <ol style={{ lineHeight: '1.8' }}>
          <li>Cron job mengambil data dari tab <strong>"Telah Diproses"</strong> Desty setiap 2 menit</li>
          <li>Data disimpan ke tabel <code>orders</code> & <code>order_items</code> di Supabase</li>
          <li>Shipping Board membaca data langsung dari Supabase tanpa CORS</li>
          <li>Scan staff dicocokkan dengan tracking number (shipmentNo) untuk status Clear/Belum</li>
        </ol>
      </div>
    </div>
  );
}
