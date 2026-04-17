import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import { Plus, Search, Trash2, Printer, Download, RefreshCw, Database } from 'lucide-react';
import DeliveryNoteModal from '../components/DeliveryNoteModal';
import { generateDeliveryNotePDF } from '../utils/pdfGenerator';

interface DeliveryNote {
    id: string;
    note_date: string;
    sender_name: string;
    expedition: string;
    items: string[];
    user_name: string;
    created_at: string;
    sender_address: string;
    courier_name: string | null;
}

export default function DeliveryNotes() {
    const [notes, setNotes] = useState<DeliveryNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // User Role Check untuk tombol hapus
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        checkUserRole();
        fetchNotes();
    }, []);

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
            if (data?.role === 'admin') setIsAdmin(true);
        }
    };

    const fetchNotes = async () => {
        setLoading(true);
        try {
            let query = supabase.from('delivery_notes').select('*').order('created_at', { ascending: false });

            if (searchQuery.trim() !== '') {
                query = query.or(`sender_name.ilike.%${searchQuery}%,expedition.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setNotes(data || []);
        } catch (error) {
            console.error('Error fetching delivery notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchNotes();
    };

    const handleDelete = async (id: string, sender: string) => {
        const conf = window.confirm(`PERINGATAN!\nYakin ingin menghapus dokumen Berita Acara dari pengirim "${sender}" secara permanen?`);
        if (conf) {
            const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
            if (error) {
                alert('Gagal menghapus: ' + error.message);
            } else {
                fetchNotes();
            }
        }
    };

    const handlePrint = (note: DeliveryNote) => {
        generateDeliveryNotePDF({
            note_date: note.note_date,
            sender_name: note.sender_name,
            sender_address: note.sender_address,
            expedition: note.expedition,
            courier_name: note.courier_name || undefined,
            items: note.items,
        }, 'print');
    };

    const handleDownload = (note: DeliveryNote) => {
        generateDeliveryNotePDF({
            note_date: note.note_date,
            sender_name: note.sender_name,
            sender_address: note.sender_address,
            expedition: note.expedition,
            courier_name: note.courier_name || undefined,
            items: note.items,
        }, 'download');
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Arsip Berita Acara</h1>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary" 
                    style={{ padding: '0.75rem 1.5rem', fontWeight: 800 }}
                >
                    <Plus size={20} /> Buat Berita Acara
                </button>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', borderTop: '4px solid var(--primary)' }}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px', display: 'flex', position: 'relative' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Cari berdasarkan Nama Pengirim atau Ekspedisi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '2.5rem', border: '2px solid var(--border)' }}
                        />
                        <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button type="submit" className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        Filter Pencarian
                    </button>
                    {searchQuery && (
                        <button type="button" onClick={() => { setSearchQuery(''); setTimeout(fetchNotes, 100); }} className="btn btn-outline">
                            Reset
                        </button>
                    )}
                </form>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <div className="table-container" style={{ border: 'none' }}>
                    <table style={{ minWidth: '800px' }}>
                        <thead>
                            <tr style={{ background: '#1e293b' }}>
                                <th style={{ color: 'white' }}>Tanggal</th>
                                <th style={{ color: 'white' }}>Pihak Pertama (Pengirim)</th>
                                <th style={{ color: 'white' }}>Pihak Kedua (Ekspedisi)</th>
                                <th style={{ color: 'white', textAlign: 'center' }}>Total Paket</th>
                                <th style={{ color: 'white' }}>Pembuat Docs</th>
                                <th style={{ color: 'white', textAlign: 'center' }}>Aksi Dokumen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center" style={{ padding: '4rem', color: 'var(--text-muted)' }}>
                                        <RefreshCw className="animate-spin" size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                                        Mencari Arsip...
                                    </td>
                                </tr>
                            ) : notes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center" style={{ padding: '6rem 2rem', color: 'var(--text-muted)' }}>
                                        <Database size={64} color="var(--border)" style={{ margin: '0 auto 1rem' }} />
                                        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Belum Ada Berita Acara</h2>
                                        <p>Klik tombol "Buat Berita Acara" di pojok kanan atas untuk memulainya.</p>
                                    </td>
                                </tr>
                            ) : (
                                notes.map((note) => (
                                    <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ fontWeight: 700 }}>
                                            <div>{dayjs(note.note_date).format('DD MMM YYYY')}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Dibuat: {dayjs(note.created_at).format('HH:mm')}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 800, color: 'var(--primary)' }}>{note.sender_name}</div>
                                            <div className="truncate" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {note.sender_address}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{note.expedition}</div>
                                            {note.courier_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kurir: {note.courier_name}</div>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', borderRadius: '50px', fontWeight: 900 }}>
                                                {note.items.length} Resi
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                    {note.user_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontSize: '0.85rem' }}>{note.user_name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button onClick={() => handlePrint(note)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#10b981', borderColor: '#a7f3d0', background: '#ecfdf5' }} title="Cetak Langsung">
                                                    <Printer size={18} />
                                                </button>
                                                <button onClick={() => handleDownload(note)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#0ea5e9', borderColor: '#bae6fd', background: '#f0f9ff' }} title="Download PDF">
                                                    <Download size={18} />
                                                </button>
                                                {isAdmin && (
                                                    <button onClick={() => handleDelete(note.id, note.sender_name)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }} title="Hapus Dokumen (Admin)">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: '#f8fafc', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Menampilkan total {notes.length} dokumen.
                </div>
            </div>

            <DeliveryNoteModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchNotes();
                }}
            />
        </div>
    );
}
