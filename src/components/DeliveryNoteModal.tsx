import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import { X, Search, CheckSquare, Square, RefreshCw, AlertCircle } from 'lucide-react';

interface ScanItem {
    id: string;
    resi: string;
    scanned_time: string;
}

interface DeliveryNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function DeliveryNoteModal({ isOpen, onClose, onSuccess }: DeliveryNoteModalProps) {
    const [noteDate, setNoteDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [senderName, setSenderName] = useState('');
    const [senderAddress, setSenderAddress] = useState('');
    const [expedition, setExpedition] = useState('');
    const [courierName, setCourierName] = useState('');
    
    // Resi Selection State
    const [scanDate, setScanDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [availableResi, setAvailableResi] = useState<ScanItem[]>([]);
    const [selectedResi, setSelectedResi] = useState<Set<string>>(new Set());
    const [searchResi, setSearchResi] = useState('');
    const [loadingResi, setLoadingResi] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchResi();
        }
    }, [isOpen, scanDate]);

    const fetchResi = async () => {
        setLoadingResi(true);
        try {
            // Hanya ambil resi yang berstatus KELUAR pada tanggal yang dipilih
            const { data, error } = await supabase
                .from('scans')
                .select('id, resi, scanned_time')
                .eq('status', 'KELUAR')
                .eq('scanned_date', scanDate)
                .order('scanned_time', { ascending: false });

            if (error) throw error;
            setAvailableResi(data || []);
            // Jangan reset selectedResi saat ganti tanggal (biarkan milih lintas tanggal jika mau)
        } catch (error: any) {
            console.error('Error fetching resi:', error);
        } finally {
            setLoadingResi(false);
        }
    };

    const handleSelectAll = () => {
        const currentFiltered = availableResi.filter(item => item.resi.toLowerCase().includes(searchResi.toLowerCase()));
        const allSelected = currentFiltered.every(item => selectedResi.has(item.resi));
        
        const newSelected = new Set(selectedResi);
        if (allSelected) {
            // Deselect all in current view
            currentFiltered.forEach(item => newSelected.delete(item.resi));
        } else {
            // Select all in current view
            currentFiltered.forEach(item => newSelected.add(item.resi));
        }
        setSelectedResi(newSelected);
    };

    const toggleResi = (resi: string) => {
        const newSelected = new Set(selectedResi);
        if (newSelected.has(resi)) {
            newSelected.delete(resi);
        } else {
            newSelected.add(resi);
        }
        setSelectedResi(newSelected);
    };

    const handleSave = async () => {
        setErrorMsg('');
        if (!senderName.trim() || !senderAddress.trim() || !expedition.trim()) {
            setErrorMsg('Harap lengkapi Nama Pengirim, Alamat, dan Ekspedisi.');
            return;
        }
        if (selectedResi.size === 0) {
            setErrorMsg('Harap pilih minimal 1 resi untuk dimasukkan ke Berita Acara.');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User Lapangan';

            const payload = {
                note_date: noteDate,
                sender_name: senderName,
                sender_address: senderAddress,
                expedition: expedition,
                courier_name: courierName || null,
                items: Array.from(selectedResi),
                user_id: user?.id,
                user_name: userName
            };

            const { error } = await supabase.from('delivery_notes').insert([payload]);
            if (error) throw error;

            onSuccess();
            handleReset();
        } catch (error: any) {
            console.error('Error saving delivery note:', error);
            setErrorMsg(error.message || 'Terjadi kesalahan sistem saat menyimpan.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setSenderName('');
        setSenderAddress('');
        setExpedition('');
        setCourierName('');
        setSelectedResi(new Set());
        setSearchResi('');
        setErrorMsg('');
        onClose();
    };

    if (!isOpen) return null;

    const filteredResi = availableResi.filter(item => item.resi.toLowerCase().includes(searchResi.toLowerCase()));
    const isAllSelected = filteredResi.length > 0 && filteredResi.every(item => selectedResi.has(item.resi));

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
            <div className="card" style={{ 
                width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', padding: '0'
            }}>
                {/* HEAD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>Detail Berita Acara Baru</h2>
                    <button onClick={handleReset} style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '50%' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* BODY */}
                <div className="responsive-grid" style={{ padding: '1.5rem', gap: '2rem' }}>
                    {/* FORM IDENTITAS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>HARI & TANGGAL (Di Dokumen)</label>
                            <input type="date" className="input" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>NAMA PENGIRIM</label>
                                <input type="text" className="input" placeholder="SUKSES DIGIMED..." value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                            </div>
                            <div>
                                <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>EKSPEDISI</label>
                                <input type="text" className="input" placeholder="JNT, JNE..." value={expedition} onChange={(e) => setExpedition(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>ALAMAT PENGIRIM</label>
                            <textarea className="input" rows={3} placeholder="Jl. Kantil..." value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} style={{ resize: 'vertical' }} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>NAMA KURIR (OPSIONAL)</label>
                            <input type="text" className="input" placeholder="Nama Pihak Kedua" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
                        </div>
                    </div>

                    {/* SELECTOR RESI */}
                    <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>AMBIL RESI (STATUS KELUAR)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input type="date" className="input" value={scanDate} onChange={(e) => setScanDate(e.target.value)} style={{ flex: 1, padding: '0.5rem' }} title="Tanggal Scan Keluar" />
                                <div style={{ position: 'relative', flex: 2 }}>
                                    <input type="text" className="input" placeholder="Cari Resi..." value={searchResi} onChange={(e) => setSearchResi(e.target.value)} style={{ padding: '0.5rem', paddingLeft: '2rem' }} />
                                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)' }} />
                                </div>
                            </div>
                        </div>

                        {/* INFO & SELECT ALL */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <button onClick={handleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-main)', padding: '0.5rem' }} disabled={filteredResi.length === 0}>
                                {isAllSelected ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--text-muted)" />}
                                Select All Tampil
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {selectedResi.size} Resi Terpilih
                            </span>
                        </div>

                        {/* LIST RESI */}
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                            {loadingResi ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                                    Memuat Data...
                                </div>
                            ) : filteredResi.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Tidak ada resi keluar ditemukan.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {filteredResi.map((item) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleResi(item.resi)}
                                            style={{ 
                                                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', 
                                                borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s',
                                                background: selectedResi.has(item.resi) ? '#f0f9ff' : 'transparent',
                                                border: selectedResi.has(item.resi) ? '1px solid #bae6fd' : '1px solid transparent'
                                            }}
                                        >
                                            {selectedResi.has(item.resi) ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--border)" />}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.resi}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Scan pkl: {item.scanned_time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {errorMsg && <><AlertCircle size={16} /> {errorMsg}</>}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handleReset} className="btn" style={{ background: '#e2e8f0', color: '#475569' }} disabled={saving}>Batal</button>
                        <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem' }}>
                            {saving ? <RefreshCw className="animate-spin" size={20} /> : 'Simpan & Lihat PDF'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
