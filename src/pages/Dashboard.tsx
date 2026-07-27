import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import { PackageOpen, PackageCheck, AlertTriangle, Users, Database } from 'lucide-react';

export default function Dashboard({ userRole }: { userRole: 'admin' | 'staff' | null }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        masukToday: 0, keluarToday: 0, returToday: 0, totalUsers: 0
    });

    const fetchStats = async () => {
        setLoading(true);
        try {
            const todayDate = dayjs().format('YYYY-MM-DD');
            const [resMasuk, resKeluar, resRetur] = await Promise.all([
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'MASUK'),
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'KELUAR'),
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'RETUR'),
            ]);
            setStats({
                masukToday: resMasuk.count || 0,
                keluarToday: resKeluar.count || 0,
                returToday: resRetur.count || 0,
                totalUsers: 1,
            });
        } catch (error) {
            console.error('Error loading dashboard', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Proteksi: Jika dia staff tapi iseng tembak URL ke / , jangan tunjukkan dashboard komersil
    if (userRole === 'staff') {
        return (
            <div className="card text-center" style={{ padding: '3rem', marginTop: '2rem' }}>
                <Database size={64} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
                <h2>Anda Tidak Punya Akses Papan Pantau</h2>
                <p style={{ color: 'var(--text-muted)' }}>Hak akses ini dibatasi untuk kepala gudang (Administrator).</p>
            </div>
        );
    }

    return (
        <div>
            <h1 className="page-title">Papan Komando Admin</h1>

            <div className="card" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#fdf4ff', borderLeft: '6px solid #e879f9' }}>
                <Users size={32} color="#c026d3" />
                <div>
                    <div style={{ fontWeight: 800, color: '#a21caf' }}>Total {loading ? '...' : stats.totalUsers} Pekerja Terdeteksi Sedang Nge-Scan.</div>
                    <div style={{ fontSize: '0.8rem', color: '#86198f' }}>Data berdasarkan sinkronisasi hari ini secara real-time.</div>
                </div>
            </div>

            <div className="grid-cards" style={{ marginBottom: '2rem' }}>
                <div className="card stat-card" style={{ borderTop: '4px solid var(--primary)' }}>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)' }}>
                        <PackageOpen size={28} />
                    </div>
                    <div className="stat-info">
                        <h3>Paket Masuk Gudang Hari Ini</h3>
                        <p style={{ color: 'var(--primary)', fontSize: '2rem' }}>{loading ? '...' : stats.masukToday}</p>
                    </div>
                </div>

                <div className="card stat-card" style={{ borderTop: '4px solid var(--success)' }}>
                    <div className="stat-icon success">
                        <PackageCheck size={28} />
                    </div>
                    <div className="stat-info">
                        <h3>Paket Diserahkan Keluar / Kurir</h3>
                        <p style={{ color: 'var(--success)', fontSize: '2rem' }}>{loading ? '...' : stats.keluarToday}</p>
                    </div>
                </div>

                <div className="card stat-card" style={{ borderTop: '4px solid var(--danger)' }}>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                        <AlertTriangle size={28} />
                    </div>
                    <div className="stat-info">
                        <h3>Paket Tertolak / Retur</h3>
                        <p style={{ color: 'var(--danger)', fontSize: '2rem' }}>{loading ? '...' : stats.returToday}</p>
                    </div>
                </div>
            </div>

            {/* DESTY OMNI — managed from Shipping Board */}

            <div className="card" style={{ border: '1px solid var(--border)', background: 'white' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 800 }}>Sinkronisasi Segar</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Manajer melihat pergerakan secara murni tanpa campur-tangan sistem staf. Anda adalah Admin, data di atas ditarik langsung dari mesin.
                </p>
                <button onClick={fetchStats} className="btn btn-primary" style={{ marginTop: '1.5rem', borderRadius: '4px' }}>
                    <Database size={20} />
                    Segarkan Data Server (Refresh)
                </button>
            </div>
        </div>
    );
}
