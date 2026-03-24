import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { Download, Search, Database, Trash2, PenSquare } from 'lucide-react';

export default function DataList() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState('hari_ini');
    const [dateStart, setDateStart] = useState(dayjs().format('YYYY-MM-DD'));
    const [dateEnd, setDateEnd] = useState(dayjs().format('YYYY-MM-DD'));
    const [searchResi, setSearchResi] = useState('');
    const [editingRow, setEditingRow] = useState<{ id: string, resi: string, status: string } | null>(null);

    const handleSaveEdit = async () => {
        if (!editingRow) return;
        setLoading(true);
        const { error } = await supabase.from('scans').update({
            resi: editingRow.resi,
            status: editingRow.status
        }).eq('id', editingRow.id);

        if (error) alert('Gagal mengedit: ' + error.message);
        else {
            setEditingRow(null);
            fetchData();
        }
        setLoading(false);
    };

    const fetchData = async () => {
        setLoading(true);
        let start, end;
        const today = dayjs().format('YYYY-MM-DD');
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

        if (filterType === 'hari_ini') {
            start = today;
            end = today;
        } else if (filterType === 'kemarin') {
            start = yesterday;
            end = yesterday;
        } else if (filterType === 'manual' || filterType === 'rentang') {
            start = dateStart;
            end = filterType === 'manual' ? dateStart : dateEnd;
        }

        let query = supabase
            .from('scans')
            .select('*')
            .gte('scanned_date', start)
            .lte('scanned_date', end)
            .order('scanned_at', { ascending: false });

        if (searchResi.trim() !== '') {
            query = query.ilike('resi', `%${searchResi}%`);
        }

        const { data: results } = await query;
        if (results) setData(results);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [filterType, dateStart, dateEnd]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
    };

    // FUNGSI ADMIN: HAPUS RIWAYAT SCAN YANG SALAH
    const handleDelete = async (id: string, resi: string) => {
        const conf = window.confirm(`PERINGATAN ADMIN!\nYakin ingin menghapus resi ${resi} permanen dari server?`);
        if (conf) {
            const { error } = await supabase.from('scans').delete().eq('id', id);
            if (error) {
                alert('Gagal menghapus: ' + error.message);
            } else {
                fetchData();
            }
        }
    };

    const handleExport = () => {
        const wsData = data.map((item, index) => ({
            'No': index + 1,
            'Nomor Resi': item.resi,
            'Status Paket': item.status,
            'Tanggal': item.scanned_date,
            'Hari': item.scanned_day,
            'Jam Keluar/Masuk': item.scanned_time,
            'Penanggung Jawab': item.user_name
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        // Desain lebar kolom Excel rapih
        ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Resi & Status');

        const fileName = `Export_Resi_Status_${filterType}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'MASUK': return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' };
            case 'KELUAR': return { background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7' };
            case 'RETUR': return { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' };
            default: return { background: '#f8fafc', color: '#475569' };
        }
    };

    return (
        <div>
            <h1 className="page-title">Pangkalan Ekspor Laporan (Admin Only)</h1>

            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', borderTop: '4px solid var(--primary)' }}>
                <div style={{ flex: '1 1 200px' }}>
                    <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>Pilih Waktu</label>
                    <select
                        className="input"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={{ border: '2px solid var(--border)' }}
                    >
                        <option value="hari_ini">Data Hari Ini Saja</option>
                        <option value="kemarin">Data Kemarin</option>
                        <option value="manual">Tembak 1 Tanggal</option>
                        <option value="rentang">Buka Rentang Tanggal</option>
                    </select>
                </div>

                {(filterType === 'manual' || filterType === 'rentang') && (
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>Mulai Tanggal</label>
                        <input
                            type="date"
                            className="input"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            style={{ border: '2px solid var(--border)' }}
                        />
                    </div>
                )}

                {filterType === 'rentang' && (
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>Sampai Tanggal</label>
                        <input
                            type="date"
                            className="input"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            style={{ border: '2px solid var(--border)' }}
                        />
                    </div>
                )}

                <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 300px', display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>Lacak Resi Satuan</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Ketik/Paste Nomor Resi..."
                            value={searchResi}
                            onChange={(e) => setSearchResi(e.target.value)}
                            style={{ border: '2px solid var(--border)' }}
                        />
                    </div>
                    <button type="submit" className="btn btn-outline" style={{ alignSelf: 'flex-end', padding: '0.75rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        <Search size={22} />
                    </button>
                </form>

                <button
                    onClick={handleExport}
                    className="btn btn-success"
                    style={{ flex: '0 0 auto', alignSelf: 'flex-end', padding: '1rem 2rem', fontSize: '1.1rem', fontWeight: 800 }}
                    disabled={data.length === 0}
                >
                    <Download size={22} />
                    <span>DOWNLOAD EXCEL UTUH</span>
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <div className="table-container" style={{ border: 'none' }}>
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: '#1e293b' }}>
                                <th style={{ color: 'white' }}>No</th>
                                <th style={{ color: 'white' }}>Nomor Resi</th>
                                <th style={{ color: 'white' }}>Status (Alur)</th>
                                <th style={{ color: 'white' }}>Kalender Sistem</th>
                                <th style={{ color: 'white' }}>Pukul (Jam)</th>
                                <th style={{ color: 'white' }}>Penembak Gudang</th>
                                <th style={{ color: 'white', textAlign: 'center' }}>Aksi Admin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center" style={{ padding: '4rem', color: 'var(--text-muted)' }}>
                                        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
                                        Memproses Jutaan Sel Data...
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center" style={{ padding: '6rem 2rem', color: 'var(--text-muted)' }}>
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <Database size={64} color="var(--border)" />
                                            <h2 style={{ color: 'var(--text-muted)', fontSize: '1.5rem' }}>Area Kosong, Nol Scan Ditemukan.</h2>
                                            <p>Coba pilih tanggal rentang yang lebih lebar di pengaturan atas.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, idx) => {
                                    const isEditing = editingRow?.id === item.id;
                                    return (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: isEditing ? '#f8fafc' : 'transparent' }}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>

                                            <td className="font-bold" style={{ color: '#0f172a', fontSize: '1.1rem', letterSpacing: '0.5px' }}>
                                                {isEditing ? (
                                                    <input type="text" className="input" style={{ width: '150px', padding: '0.4rem', fontSize: '0.9rem' }} value={editingRow?.resi || ''} onChange={e => editingRow && setEditingRow({ ...editingRow, resi: e.target.value })} />
                                                ) : item.resi}
                                            </td>

                                            <td>
                                                {isEditing ? (
                                                    <select className="input" style={{ padding: '0.4rem', fontSize: '0.8rem' }} value={editingRow?.status || 'MASUK'} onChange={e => editingRow && setEditingRow({ ...editingRow, status: e.target.value })}>
                                                        <option value="MASUK">MASUK</option>
                                                        <option value="KELUAR">KELUAR</option>
                                                        <option value="RETUR">RETUR</option>
                                                    </select>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-block', padding: '0.4rem 1rem', borderRadius: '50px',
                                                        fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px',
                                                        ...getStatusStyle(item.status)
                                                    }}>
                                                        {item.status}
                                                    </span>
                                                )}
                                            </td>

                                            <td style={{ color: 'var(--text-muted)' }}>{item.scanned_day}, {dayjs(item.scanned_date).format('DD MMM')}</td>
                                            <td style={{ fontWeight: 800 }}>{item.scanned_time} <span style={{ fontSize: '0.7rem' }}>WIB</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#475569', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                        {item.user_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: 600 }}>{item.user_name}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => setEditingRow(null)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>Batal</button>
                                                        <button onClick={handleSaveEdit} className="btn btn-success" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>Simpan</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setEditingRow({ id: item.id, resi: item.resi, status: item.status })} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#0ea5e9', borderColor: '#bae6fd', background: '#f0f9ff' }} title="Revisi Resi/Status">
                                                            <PenSquare size={16} />
                                                        </button>
                                                        <button onClick={() => handleDelete(item.id, item.resi)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#b91c1c', borderColor: '#fca5a5', background: '#fef2f2' }} title="Hapus Riwayat Salah">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '1rem', borderTop: '2px solid var(--border)', background: '#f8fafc', fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Direktori Server Aktif Terhubung</span>
                    <span>Tarikan Data Admin: <span className="font-bold text-main" style={{ color: 'var(--primary)', fontSize: '1rem' }}>{data.length}</span> Tembakan Resi Terverifikasi</span>
                </div>
            </div>
        </div>
    );
}
