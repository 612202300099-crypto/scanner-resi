import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ScanLine, FileText, LogOut, Users, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function Layout({ userRole }: { userRole: 'admin' | 'staff' | null }) {
    const navigate = useNavigate();
    const [userName, setUserName] = useState<string>('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User Gudang');
            }
        });
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="layout-wrapper">
            {/* BACKDROP MOBILE */}
            <div
                className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ScanLine size={32} color="var(--primary)" />
                        <span style={{ fontSize: '1.25rem' }}>Gudang Pintar</span>
                    </div>
                    {/* Tombol Tutup Sidebar versi Mobile */}
                    <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)} style={{ display: 'none' }}>
                        <X size={24} color="var(--text-muted)" />
                    </button>
                </div>

                <nav className="sidebar-nav" style={{ flex: 1 }}>
                    <div style={{ padding: '0 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                        Menu Pekerja
                    </div>
                    <NavLink
                        to="/scan"
                        onClick={() => setIsSidebarOpen(false)}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <ScanLine size={20} />
                        <span>Senjata Scan</span>
                    </NavLink>

                    {/* Pembatas untuk Admin Khusus */}
                    {userRole === 'admin' && (
                        <>
                            <div style={{ marginTop: '1.5rem', padding: '0 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                                Keamanan & Pimpinan
                            </div>

                            <NavLink
                                to="/"
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                end
                            >
                                <LayoutDashboard size={20} />
                                <span>Pusat Data (Dashboard)</span>
                            </NavLink>

                            <NavLink
                                to="/data"
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <FileText size={20} />
                                <span>Export Semua Resi</span>
                            </NavLink>

                            <NavLink
                                to="/karyawan"
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <Users size={20} />
                                <span>Manajemen Staf</span>
                            </NavLink>
                        </>
                    )}
                </nav>

                <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Login Sebagai:</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{userName}</span>
                        <span style={{
                            display: 'inline-block', padding: '0.2rem 0.5rem',
                            backgroundColor: userRole === 'admin' ? '#fef3c7' : '#e0e7ff',
                            color: userRole === 'admin' ? '#d97706' : '#4f46e5',
                            borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, width: 'fit-content', marginTop: '0.25rem'
                        }}>
                            {userRole === 'admin' ? '♚ ADMINISTRATOR' : '🛠 STAF LAPANGAN'}
                        </span>
                    </div>
                    <button onClick={handleLogout} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                        <LogOut size={20} />
                        <span>Kunci Layar & Keluar</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="header" style={{ display: 'flex', alignItems: 'center', background: '#ffffff', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="burger-menu" onClick={() => setIsSidebarOpen(true)} style={{ padding: '0.5rem', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <Menu size={24} color="var(--text-main)" />
                        </button>
                        <div>
                            <h2 style={{ fontSize: 'min(1.25rem, 5vw)', fontWeight: 800, margin: 0 }}>Modul Operasional</h2>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block' }}>Otomatisasi Lapis Baja Tersambung</span>
                        </div>
                    </div>
                    <div className="badge badge-primary" style={{ display: 'flex', gap: '0.5rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #10b981', alignSelf: 'center', marginLeft: 'auto' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', alignSelf: 'center' }}></div>
                        <span className="online-text">Sistem Online Aktif</span>
                    </div>
                </header>

                <div className="page-content" style={{ backgroundColor: '#f1f5f9' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
