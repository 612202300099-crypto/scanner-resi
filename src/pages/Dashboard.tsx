import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import { PackageOpen, PackageCheck, AlertTriangle, Users, Database, Truck, ClipboardList } from 'lucide-react';
import { getDailyShippingStats, type DailyShippingStats } from '../services/destyService';

export default function Dashboard({ userRole }: { userRole: 'admin' | 'staff' | null }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        masukToday: 0,
        keluarToday: 0,
        returToday: 0,
        totalUsers: 0
    });

    const [destyStats, setDestyStats] = useState<DailyShippingStats | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const todayDate = dayjs().format('YYYY-MM-DD');

            const [resMasuk, resKeluar, resRetur, resUsers, destyData] = await Promise.all([
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'MASUK'),
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'KELUAR'),
                supabase.from('scans').select('*', { count: 'exact', head: true }).eq('scanned_date', todayDate).eq('status', 'RETUR'),
                supabase.rpc('get_unique_users_today', { date_param: todayDate }),
                getDailyShippingStats().catch(() => null),
            ]);

            setStats({
                masukToday: resMasuk.count || 0,
                keluarToday: resKeluar.count || 0,
                returToday: resRetur.count || 0,
                totalUsers: resUsers.data ? resUsers.data.length : 1,
            });

            setDestyStats(destyData);
        } catch (error) {
            console.error('Error memuat papan kendali info', error);
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

            {/* DESTY OMNI INTEGRATION STATS */}
            {destyStats && (
                <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid #6366f1', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Truck size={24} color="#6366f1" />
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#4f46e5' }}>
                            📊 Status Pengiriman Order Marketplace (Desty Omni)
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <div style={{ textAlign: 'center', padding: '1rem', background: '#f5f3ff', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 700 }}>Total Order</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4f46e5' }}>{destyStats.total_orders}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: '#ecfdf5', borderRadius: '8px' }}>
                            <ClipboardList size={20} color="#10b981" />
                            <div style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>Sudah Clear</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{destyStats.shipped_orders}</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>Belum Dikirim</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706' }}>{destyStats.pending_orders}</div>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                            <span>Progress</span>
                            <span>{destyStats.total_orders > 0 ? Math.round((destyStats.shipped_orders / destyStats.total_orders) * 100) : 0}%</span>
                        </div>
                        <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${destyStats.total_orders > 0 ? (destyStats.shipped_orders / destyStats.total_orders) * 100 : 0}%`, background: destyStats.pending_orders === 0 ? 'var(--success)' : '#6366f1', borderRadius: '5px', transition: 'width 0.5s' }} />
                        </div>
                    </div>
                </div>
            )}

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
