import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import { Plus, Search, Trash2, Printer, Download, RefreshCw, Database, Image as ImageIcon, Camera, Eye, Lock } from 'lucide-react';
import DeliveryNoteModal from '../components/DeliveryNoteModal';
import DetailPreview from '../components/DetailPreview';
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
    photo_data?: string | null;
    is_finalized?: boolean;
    photo_source?: 'camera' | 'gallery';
}

export default function DeliveryNotes() {
    const [notes, setNotes] = useState<DeliveryNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // State untuk Update Foto Susulan
    const [editNoteId, setEditNoteId] = useState<string | null>(null);
    const [editInitialData, setEditInitialData] = useState<any>(null);

    // State untuk Detail Preview
    const [previewNote, setPreviewNote] = useState<DeliveryNote | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [finalizingId, setFinalizingId] = useState<string | null>(null);

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

    const openAddPhotoModal = (note: DeliveryNote) => {
        setEditNoteId(note.id);
        setEditInitialData({
            sender_name: note.sender_name,
            sender_address: note.sender_address,
            expedition: note.expedition,
            courier_name: note.courier_name,
            note_date: note.note_date,
            items: note.items,
            photo_data: note.photo_data,
            is_finalized: note.is_finalized,
        });
        setIsModalOpen(true);
    };

    const handlePreviewClick = (note: DeliveryNote) => {
        setPreviewNote(note);
        setShowPreview(true);
    };

    const handleFinalize = async () => {
        if (!previewNote?.id) return;
        
        setFinalizingId(previewNote.id);
        try {
            const { error } = await supabase
                .from('delivery_notes')
                .update({ is_finalized: true })
                .eq('id', previewNote.id);

            if (error) throw error;

            // Update preview state
            setPreviewNote({ ...previewNote, is_finalized: true });
            fetchNotes(); // Refresh list
        } catch (error: any) {
            console.error('Error finalizing:', error);
            alert('Gagal mem-finalisasi: ' + error.message);
        } finally {
            setFinalizingId(null);
        }
    };

    return (
        <div style={{ padding: '0 0.5rem' }}>
            <style>{`
                @media (max-width: 640px) {
                    .page-header {
                        flex-direction: column;
                        align-items: stretch !important;
                    }
                    .btn-create {
                        width: 100%;
                        justify-content: center;
                    }
                    .table-container {
                        margin-bottom: 2rem;
                    }
                    .hide-on-mobile {
                        display: none !important;
                    }
                    .status-badge {
                        font-size: 0.7rem !important;
                        padding: 0.2rem 0.4rem !important;
                    }
                }
            `}</style>

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h1 className="page-title" style={{ margin: 0, fontSize: 'clamp(1.25rem, 5vw, 1.75rem)' }}>Arsip Berita Acara</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Kelola bukti penyerahan fisik & digital.</p>
                </div>
                <button 
                    onClick={() => { setEditNoteId(null); setEditInitialData(null); setIsModalOpen(true); }}
                    className="btn btn-primary btn-create" 
                    style={{ padding: '0.75rem 1.5rem', fontWeight: 800, boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.3)' }}
                >
                    <Plus size={20} /> Buat Baru
                </button>
            </div>

            <div className="card" style={{ marginBottom: '1rem', borderTop: '4px solid var(--primary)', padding: '1rem' }}>
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', position: 'relative' }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Cari pengirim/ekspedisi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '2.25rem', border: '2px solid var(--border)' }}
                        />
                        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)' }} />
                    </div>
                    <button type="submit" className="btn btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                        Cari
                    </button>
                    {searchQuery && (
                        <button type="button" onClick={() => { setSearchQuery(''); setTimeout(fetchNotes, 100); }} className="btn btn-outline">
                            Hapus
                        </button>
                    )}
                </form>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                    <table style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#1e293b' }}>
                                <th style={{ color: 'white', padding: '1rem' }}>Tgl Dokumen</th>
                                <th style={{ color: 'white', padding: '1rem' }}>Status Bukti</th>
                                <th style={{ color: 'white', padding: '1rem' }}>Pengirim / Ekspedisi</th>
                                <th className="hide-on-mobile" style={{ color: 'white', padding: '1rem', textAlign: 'center' }}>Total Resi</th>
                                <th className="hide-on-mobile" style={{ color: 'white', padding: '1rem' }}>Admin</th>
                                <th style={{ color: 'white', padding: '1rem', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center" style={{ padding: '4rem', color: 'var(--text-muted)' }}>
                                        <RefreshCw className="animate-spin" size={40} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} />
                                        Sinkronisasi...
                                    </td>
                                </tr>
                            ) : notes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center" style={{ padding: '6rem 2rem', color: 'var(--text-muted)' }}>
                                        <Database size={54} color="var(--border)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p>Belum ada data terekam.</p>
                                    </td>
                                </tr>
                            ) : (
                                notes.map((note) => (
                                    <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{dayjs(note.note_date).format('DD/MM/YY')}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {note.id.split('-')[0]}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                {note.is_finalized && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                        <Lock size={12} /> LOCKED
                                                    </span>
                                                )}
                                                {note.photo_data ? (
                                                    <span className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #10b981', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                        <ImageIcon size={12} /> ADA FOTO
                                                    </span>
                                                ) : (
                                                    <span className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#fff7ed', color: '#9a3412', border: '1px solid #f97316', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                                        <Camera size={12} /> NO PHOTO
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>{note.sender_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', opacity: 0.8 }}>VIA: {note.expedition}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="hide-on-mobile">{note.sender_address.substring(0, 30)}...</div>
                                        </td>
                                        <td className="hide-on-mobile" style={{ textAlign: 'center', padding: '0.75rem 1rem' }}>
                                            <span style={{ fontWeight: 900, fontSize: '1rem' }}>{note.items.length}</span>
                                        </td>
                                        <td className="hide-on-mobile" style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{note.user_name}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                {/* BUTTON PREVIEW DETAIL */}
                                                <button onClick={() => handlePreviewClick(note)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#7c3aed', borderColor: '#d8b4fe', background: '#f5f3ff' }} title="Preview Detail">
                                                    <Eye size={16} />
                                                </button>

                                                {/* TOMBOL TAMBAH FOTO (JIKA KOSONG DAN BELUM FINALIZED) */}
                                                {!note.photo_data && !note.is_finalized && (
                                                    <button onClick={() => openAddPhotoModal(note)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#ea580c', borderColor: '#fdba74', background: '#fff7ed' }} title="Lengkapi Foto">
                                                        <Camera size={16} /> <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>FOTO</span>
                                                    </button>
                                                )}
                                                
                                                {/* TOMBOL EDIT FOTO (JIKA ADA FOTO DAN BELUM FINALIZED) */}
                                                {note.photo_data && !note.is_finalized && (
                                                    <button onClick={() => openAddPhotoModal(note)} className="btn btn-outline" style={{ padding: '0.4rem 0.6rem', color: '#0ea5e9', borderColor: '#7dd3fc', background: '#f0f9ff' }} title="Edit Foto">
                                                        <Camera size={16} /> <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>EDIT</span>
                                                    </button>
                                                )}
                                                
                                                {note.photo_data && (
                                                    <a href={note.photo_data} download={`Foto_${note.expedition}_${note.note_date}.jpg`} className="btn btn-outline" style={{ padding: '0.4rem', color: '#f59e0b', borderColor: '#fde68a', background: '#fffbeb' }} title="Download Foto">
                                                        <ImageIcon size={18} />
                                                    </a>
                                                )}
                                                
                                                <button onClick={() => handlePrint(note)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#10b981', borderColor: '#a7f3d0' }} title="Cetak">
                                                    <Printer size={18} />
                                                </button>
                                                
                                                <button onClick={() => handleDownload(note)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#10b981', borderColor: '#a7f3d0' }} title="PDF">
                                                    <Download size={18} />
                                                </button>

                                                {isAdmin && !note.is_finalized && (
                                                    <button onClick={() => handleDelete(note.id, note.sender_name)} className="btn btn-outline" style={{ padding: '0.4rem', color: '#ef4444', borderColor: '#fca5a5' }} title="Hapus">
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
            </div>

            <DeliveryNoteModal 
                isOpen={isModalOpen} 
                onClose={() => { setIsModalOpen(false); setEditNoteId(null); setEditInitialData(null); }} 
                onSuccess={() => {
                    setIsModalOpen(false);
                    setEditNoteId(null);
                    setEditInitialData(null);
                    fetchNotes();
                }}
                editId={editNoteId}
                initialData={editInitialData}
            />

            {showPreview && previewNote && (
                <DetailPreview
                    note={previewNote}
                    onClose={() => setShowPreview(false)}
                    onEdit={() => {
                        setShowPreview(false);
                        openAddPhotoModal(previewNote);
                    }}
                    onFinalize={handleFinalize}
                    isFinalizing={finalizingId === previewNote.id}
                />
            )}
        </div>
    );
}
