import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, Users, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';

// Klien khusus agar saat Admin mendaftarkan akun baru, Admin TIDAK otomatis ter-Logout!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const adminMakerClient = createClient(supabaseUrl, supabaseKey, {
    auth: { storageKey: 'admin-temp-session', persistSession: false }
});

export default function ManageUsers() {
    const [staffs, setStaffs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');

    // Form State
    const [newEmail, setNewEmail] = useState('');
    const [newPass, setNewPass] = useState('');
    const [newName, setNewName] = useState('');
    const [notif, setNotif] = useState<{ type: 'ok' | 'err', msg: string } | null>(null);

    const fetchStaffs = async () => {
        setLoading(true);
        // Admin bisa ambil semua dari tabel user_roles karena RLS select policy kita buat true utk admin
        const { data } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
        if (data) setStaffs(data);
        setLoading(false);
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setCurrentUserId(data.user.id);
        });
        fetchStaffs();
    }, []);

    const handleCreateWorker = async (e: React.FormEvent) => {
        e.preventDefault();
        setNotif(null);
        if (newPass.length < 6) return setNotif({ type: 'err', msg: 'Kata sandi pelacak minimal 6 karakter.' });

        try {
            // Gunakan Klien Terpisah untuk mendaftar tanpa Logout Admin
            const { data, error } = await adminMakerClient.auth.signUp({
                email: newEmail,
                password: newPass,
                options: {
                    data: { full_name: newName }
                }
            });

            if (error) throw error;
            if (data.user) {
                setNotif({ type: 'ok', msg: `Akun staf lapangan [${newName}] sukses tercetak! Trigger DB berhasil.` });
                setNewEmail('');
                setNewPass('');
                setNewName('');
                fetchStaffs(); // Update list otomatis via Trigger Table
            }
        } catch (err: any) {
            setNotif({ type: 'err', msg: 'Gagal mencetak pegawai: ' + err.message });
        }
    };

    const handleDeleteStaff = async (userId: string, name: string) => {
        const conf = window.confirm(`PEMBUNUHAN AKUN PERMANEN!\nAkun Login [${name}] akan diblokir & dihanguskan total dari server database!! (Riwayat scan lamanya tetap aman dengan namanya).\nLanjutkan Eksekusi Mati?`);
        if (conf) {
            // Gunakan Fungsi Bedah Jantung Database (RPC) yang barusan kita buat
            const { error } = await supabase.rpc('delete_staff_account', { target_user_id: userId });

            if (error) {
                alert('Eksekusi Ditolak: ' + error.message + '\n\nPastikan Anda sudah menaruh Script SQL Master yang baru di Supabase SQL Editor!');
            } else {
                fetchStaffs();
            }
        }
    }

    return (
        <div>
            <h1 className="page-title">Pangkalan Pencetak Staf (Admin Only)</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Pekerja tidak pernah membuat mandat izinnya sendiri. Andalah sang Admin Agung yang mencetak Kartu Identitas mereka dari portal ini tanpa harus menyentuh dasbor Supabase Server lagi.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>

                {/* KIRI: Formulir Pencetak Karyawan */}
                <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: '1rem', borderTop: '4px solid #8b5cf6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#7c3aed' }}>
                        <UserPlus size={24} />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Cetak Akun Baru</h2>
                    </div>

                    {notif && (
                        <div className={`alert ${notif.type === 'err' ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: '1rem', padding: '1rem', fontSize: '0.9rem' }}>
                            {notif.type === 'err' ? <AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} /> : <CheckCircle2 size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />}
                            {notif.msg}
                        </div>
                    )}

                    <form onSubmit={handleCreateWorker}>
                        <div className="input-group">
                            <label className="input-label" style={{ fontWeight: 700 }}>Nama Pegawai Asli</label>
                            <input type="text" className="input" placeholder="Misal: Ahmad Packing" value={newName} onChange={e => setNewName(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label className="input-label" style={{ fontWeight: 700 }}>Email Identitas (Username)</label>
                            <input type="email" className="input" placeholder="ahmad@gudang.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                        </div>
                        <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="input-label" style={{ fontWeight: 700 }}>Kode Akses Kunci Cadangan</label>
                            <input type="password" className="input" placeholder="Minimal 6 Rahasia Teks" value={newPass} onChange={e => setNewPass(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#7c3aed' }}>
                            <UserPlus size={20} />
                            Cetak Identitas Kehadiran
                        </button>
                    </form>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center', backgroundColor: '#f5f3ff', padding: '0.5rem', borderRadius: '8px' }}>
                        Akun yang diciptakan otomatis berstatus "STAF LAPANGAN" di tabel server.
                    </div>
                </div>

                {/* KANAN: List Pegawai */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={24} color="var(--primary)" />
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Logika Staf Terafiliasi</h2>
                        </div>
                        <div className="badge badge-primary">{staffs.length} Manusia Tercetak</div>
                    </div>

                    <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                        <table style={{ minWidth: '100%' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th>Nama Tervalidasi</th>
                                    <th>Status Tingkat Akses</th>
                                    <th>Masa Berlaku Lahir</th>
                                    <th style={{ textAlign: 'center' }}>Pemutus Otoritas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Pengecekan Komando Database...</td></tr>
                                ) : staffs.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Server Belum Memiliki Staf Pasukan...</td></tr>
                                ) : (
                                    staffs.map((s) => (
                                        <tr key={s.user_id}>
                                            <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.full_name}</td>
                                            <td>
                                                <span style={{
                                                    display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: '50px',
                                                    fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px',
                                                    backgroundColor: s.role === 'admin' ? '#fef3c7' : '#e0e7ff',
                                                    color: s.role === 'admin' ? '#d97706' : '#4f46e5',
                                                }}>
                                                    {s.role}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)' }}>{dayjs(s.created_at).format('DD MMM YYYY, HH:mm')}</td>
                                            <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                {s.user_id === currentUserId ? (
                                                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 900, padding: '0.4rem', background: '#ecfdf5', borderRadius: '4px', border: '1px solid #a7f3d0' }}>ANDA (MANAJER)</span>
                                                ) : (
                                                    <>
                                                        {/* Tombol Mutasi Jabatan */}
                                                        <button onClick={() => {
                                                            const newRole = s.role === 'admin' ? 'staff' : 'admin';
                                                            if (window.confirm(`Ubah hak akses ${s.full_name} menjadi ${newRole.toUpperCase()}?`)) {
                                                                supabase.from('user_roles').update({ role: newRole }).eq('user_id', s.user_id).then(({ error }) => {
                                                                    if (error) alert('Gagal mutasi: ' + error.message); else fetchStaffs();
                                                                });
                                                            }
                                                        }} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: s.role === 'admin' ? '#4f46e5' : '#d97706' }} title="Promosi/Turun Jabatan">
                                                            Jadikan {s.role === 'admin' ? 'Staf' : 'Admin'}
                                                        </button>

                                                        <button onClick={() => handleDeleteStaff(s.user_id, s.full_name)} className="btn btn-outline" style={{ padding: '0.4rem', border: 'none', color: '#ef4444' }} title="Pecat Pegawai Ini">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
