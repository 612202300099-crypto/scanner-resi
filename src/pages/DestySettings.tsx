/**
 * DestySettings — Admin page for Desty Omni API configuration
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getSyncLogs, type DestySyncLog } from '../services/destyService';
import dayjs from 'dayjs';
import {
  Settings,
  Key,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Globe,
  Clock,
  Zap,
} from 'lucide-react';

interface DestyConfig {
  id: string;
  access_token: string;
  token_type: string;
  expire_time: string;
  apply_id: string;
  company_name: string;
  company_email: string;
  is_active: boolean;
}

export default function DestySettings() {
  const [config, setConfig] = useState<DestyConfig | null>(null);
  const [syncLogs, setSyncLogs] = useState<DestySyncLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Form state
  const [applyId, setApplyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('desty_api_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setConfig(data as DestyConfig);
      setApplyId(data.apply_id || '');
      setCompanyName(data.company_name || '');
      setCompanyEmail(data.company_email || '');
      // Don't show full token for security
    }
  };

  const fetchLogs = async () => {
    const logs = await getSyncLogs(20);
    setSyncLogs(logs);
  };

  const handleSave = async () => {
    setSaving(true);
    setNotif(null);

    try {
      const payload = {
        apply_id: applyId,
        company_name: companyName,
        company_email: companyEmail,
        access_token: accessToken || config?.access_token || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        await supabase
          .from('desty_api_config')
          .update(payload)
          .eq('id', config.id);
      } else {
        await supabase.from('desty_api_config').insert(payload);
      }

      setNotif({ type: 'ok', msg: 'Konfigurasi Desty berhasil disimpan!' });
      fetchConfig();
    } catch (err: unknown) {
      setNotif({ type: 'err', msg: 'Gagal menyimpan: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setNotif(null);
    try {
      // Trigger the edge function
      const { data, error } = await supabase.functions.invoke('desty-sync', {
        method: 'POST',
      });

      if (error) throw error;
      setNotif({
        type: 'ok',
        msg: `Sync selesai! ${(data as Record<string, unknown>)?.fetched || 0} order diproses.`,
      });
      fetchLogs();
    } catch (err: unknown) {
      setNotif({ type: 'err', msg: 'Sync gagal: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  const isTokenExpired = config?.expire_time
    ? new Date(config.expire_time).getTime() < Date.now()
    : true;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            ⚙️ Konfigurasi Desty Omni
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Atur koneksi API dan token autentikasi
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* LEFT: Config form */}
        <div>
          {/* Token status */}
          <div
            className="card"
            style={{ marginBottom: '1.5rem', borderTop: `4px solid ${isTokenExpired ? 'var(--danger)' : 'var(--success)'}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isTokenExpired ? (
                <AlertCircle size={32} color="var(--danger)" />
              ) : (
                <CheckCircle2 size={32} color="var(--success)" />
              )}
              <div>
                <div style={{ fontWeight: 800 }}>
                  {isTokenExpired ? 'Token Kadaluarsa / Belum Diatur' : 'Token Aktif'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {config?.expire_time
                    ? `Kadaluarsa: ${dayjs(config.expire_time).format('DD MMM YYYY HH:mm')}`
                    : 'Belum ada token tersimpan'}
                </div>
              </div>
            </div>
          </div>

          {/* Config form */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Settings size={20} color="var(--primary)" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>API Configuration</h2>
            </div>

            {notif && (
              <div
                className={`alert ${notif.type === 'err' ? 'alert-danger' : 'alert-success'}`}
                style={{ marginBottom: '1rem', padding: '0.75rem', fontSize: '0.85rem' }}
              >
                {notif.type === 'err' ? <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> : <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />}
                {notif.msg}
              </div>
            )}

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Apply ID</label>
              <input
                type="text"
                className="input"
                placeholder="Didapat dari POST /api/auth/apply"
                value={applyId}
                onChange={(e) => setApplyId(e.target.value)}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Gunakan endpoint Apply Authorization untuk mendapatkannya.
              </span>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Company Name</label>
              <input
                type="text"
                className="input"
                placeholder="Nama perusahaan Anda"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 700 }}>Company Email</label>
              <input
                type="email"
                className="input"
                placeholder="Email perusahaan"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" style={{ fontWeight: 700 }}>
                <Key size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                Access Token (opsional — akan di-refresh otomatis)
              </label>
              <input
                type="password"
                className="input"
                placeholder="Masukkan token manual (jika ada)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>

            <button
              onClick={handleSave}
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={saving}
            >
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>

          {/* Manual sync trigger */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Zap size={20} color="#f59e0b" />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Manual Sync</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Trigger sinkronisasi order dari Desty secara manual. Normalnya berjalan otomatis tiap 5 menit.
            </p>
            <button onClick={handleTriggerSync} className="btn btn-outline" style={{ width: '100%', borderColor: '#f59e0b', color: '#f59e0b' }}>
              <RefreshCw size={18} />
              Sync Sekarang
            </button>
          </div>
        </div>

        {/* RIGHT: Sync logs */}
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} color="var(--primary)" />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Riwayat Sinkronisasi</h2>
              </div>
              <button onClick={fetchLogs} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem' }}>
                <RefreshCw size={14} />
              </button>
            </div>

            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {syncLogs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Globe size={48} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                  Belum ada riwayat sync
                </div>
              ) : (
                <div>
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '0.75rem 1.25rem',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                          {log.sync_type}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {dayjs(log.started_at).format('DD/MM HH:mm')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)' }}>
                        <span>📥 {log.orders_fetched} fetched</span>
                        <span>🆕 {log.orders_created} new</span>
                        <span>🔄 {log.orders_updated} updated</span>
                      </div>
                      {log.errors && (
                        <div style={{ marginTop: '0.25rem', color: 'var(--danger)', fontSize: '0.7rem' }}>
                          ⚠️ {log.errors.substring(0, 200)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
