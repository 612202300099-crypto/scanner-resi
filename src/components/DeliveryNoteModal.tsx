import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { X, Search, CheckSquare, Square, RefreshCw, AlertCircle, Camera, Image as ImageIcon } from 'lucide-react';

// Atur lokal ID untuk nama hari yang proper
dayjs.locale('id');

interface ScanItem {
    id: string;
    resi: string;
    scanned_time: string;
}

interface DeliveryNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editId?: string | null;
    initialData?: {
        sender_name: string;
        sender_address: string;
        expedition: string;
        courier_name: string | null;
        note_date: string;
        items: string[];
    } | null;
}

export default function DeliveryNoteModal({ isOpen, onClose, onSuccess, editId, initialData }: DeliveryNoteModalProps) {
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
    
    // Camera State
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (editId && initialData) {
                // Mode Update Foto: Load data yang ada
                setNoteDate(initialData.note_date);
                setSenderName(initialData.sender_name);
                setSenderAddress(initialData.sender_address);
                setExpedition(initialData.expedition);
                setCourierName(initialData.courier_name || '');
                setSelectedResi(new Set(initialData.items));
                // Jangan load resi baru karena sudah diparkir
                setAvailableResi([]);
            } else {
                // Mode Create New
                handleResetState();
                fetchResi();
            }
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, scanDate, editId, initialData]);

    const handleResetState = () => {
        setNoteDate(dayjs().format('YYYY-MM-DD'));
        setSenderName('');
        setSenderAddress('');
        setExpedition('');
        setCourierName('');
        setSelectedResi(new Set());
        setSearchResi('');
        setPhotoBase64(null);
        setErrorMsg('');
    };

    const fetchResi = async () => {
        if (editId) return; // Jangan fetch resi di mode update foto
        setLoadingResi(true);
        try {
            const { data, error } = await supabase
                .from('scans')
                .select('id, resi, scanned_time')
                .eq('status', 'KELUAR')
                .eq('scanned_date', scanDate)
                .order('scanned_time', { ascending: false });

            if (error) throw error;
            setAvailableResi(data || []);
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
            currentFiltered.forEach(item => newSelected.delete(item.resi));
        } else {
            currentFiltered.forEach(item => newSelected.add(item.resi));
        }
        setSelectedResi(newSelected);
    };

    const toggleResi = (resi: string) => {
        if (editId) return; // Kunci resi di mode update foto
        const newSelected = new Set(selectedResi);
        if (newSelected.has(resi)) {
            newSelected.delete(resi);
        } else {
            newSelected.add(resi);
        }
        setSelectedResi(newSelected);
    };

    // KAMERA ENGINE ========
    const startCamera = async () => {
        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (fallbackErr) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            
            streamRef.current = stream;
            setIsCameraActive(true);
            setPhotoBase64(null);
            
            // Tunggu DOM selesai nge-render elemen <video> lalu pasang sumbernya
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error("Video play blocked:", e));
                }
            }, 250);
        } catch (err: any) {
            alert('Akses Kamera Terblokir/Tidak Ditemukan. Pastikan link diawali HTTPS. Error: ' + err.message);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraActive(false);
    };

    const captureAndWatermark = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ambil resolusi asli video, tapi batas maksimal 1280px agar enteng di database (~150KB compress)
        let w = video.videoWidth;
        let h = video.videoHeight;
        const maxRes = 1280; 
        if (w > maxRes || h > maxRes) {
            if (w > h) {
                h = Math.round(h * (maxRes / w));
                w = maxRes;
            } else {
                w = Math.round(w * (maxRes / h));
                h = maxRes;
            }
        }

        canvas.width = w;
        canvas.height = h;

        // 1. Gambar Video Frame
        ctx.drawImage(video, 0, 0, w, h);

        // 2. Pasang Watermark Teks (Shadow Hitam Tebal, Font Kuning/Putih biar kentara)
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const fontSize = Math.max(16, Math.floor(w / 35)); // Dinamis responsive layout
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#fbbf24"; // Warna Kuning Amber
        
        ctx.textBaseline = "top";
        const paddingLeft = fontSize;
        let currentY = fontSize;

        const dateStr = dayjs().format('dddd, DD MMMM YYYY - HH:mm WIB');
        const countResiStr = `Sebanyak: ${selectedResi.size} Paket / Resi`;
        const senderStr = `Pengirim: ${senderName || 'Tanpa Nama'}`;
        const expStr = `Penerima: ${expedition || 'Tanpa Ekspedisi'} ${courierName ? `(${courierName})` : ''}`;

        // Alamat butuh auto-wrap jika kepanjangan
        const addressTitle = "Alamat Pengirim:";
        ctx.fillText(dateStr, paddingLeft, currentY); currentY += (fontSize * 1.5);
        ctx.fillText(expStr, paddingLeft, currentY); currentY += (fontSize * 1.5);
        ctx.fillText(senderStr, paddingLeft, currentY); currentY += (fontSize * 1.5);
        ctx.fillText(countResiStr, paddingLeft, currentY); currentY += (fontSize * 1.5);
        
        ctx.fillStyle = "#ffffff"; // Alamat warnanya putih aja
        ctx.fillText(addressTitle, paddingLeft, currentY); currentY += (fontSize * 1.2);

        // Auto wrap logic sederhana untuk alamat
        const maxTextWidth = w - (paddingLeft * 3);
        const words = (senderAddress || 'Belum diisi').split(' ');
        let line = '';
        
        ctx.font = `500 ${Math.max(14, fontSize - 2)}px sans-serif`;
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxTextWidth && n > 0) {
                ctx.fillText(line, paddingLeft, currentY);
                line = words[n] + ' ';
                currentY += (fontSize * 1.2);
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, paddingLeft, currentY);

        // Export data
        const b64 = canvas.toDataURL('image/jpeg', 0.75); // Kualitas 75% sudah sangat hemat
        setPhotoBase64(b64);
        stopCamera();
    };

    // ======================

    const handleSave = async () => {
        setErrorMsg('');
        
        // Validasi identitas wajib di mode create
        if (!editId) {
            if (!senderName.trim() || !senderAddress.trim() || !expedition.trim()) {
                setErrorMsg('Harap lengkapi Nama Pengirim, Alamat, dan Ekspedisi.');
                return;
            }
            if (selectedResi.size === 0) {
                setErrorMsg('Harap pilih minimal 1 resi untuk dimasukkan ke Berita Acara.');
                return;
            }
        } else {
            // Validasi foto wajib di mode update foto
            if (!photoBase64) {
                setErrorMsg('Harap ambil foto bukti terlebih dahulu.');
                return;
            }
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User Lapangan';

            if (editId) {
                // Mode UPDATE Foto
                const { error } = await supabase
                    .from('delivery_notes')
                    .update({ photo_data: photoBase64 })
                    .eq('id', editId);
                
                if (error) throw error;
            } else {
                // Mode INSERT New (Foto Opsional)
                const payload = {
                    note_date: noteDate,
                    sender_name: senderName,
                    sender_address: senderAddress,
                    expedition: expedition,
                    courier_name: courierName || null,
                    items: Array.from(selectedResi),
                    photo_data: photoBase64 || null, // Boleh null jika kurir belum datang
                    user_id: user?.id,
                    user_name: currentUserName
                };

                const { error } = await supabase.from('delivery_notes').insert([payload]);
                if (error) throw error;
            }

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
        handleResetState();
        stopCamera();
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
            <style>{`
                @media (max-width: 768px) {
                    .modal-body-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .mobile-hide {
                        display: none !important;
                    }
                }
            `}</style>
            
            <div className="card" style={{ 
                width: '100%', maxWidth: editId ? '500px' : '1000px', maxHeight: '95vh', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', padding: '0'
            }}>
                {/* HEAD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                            {editId ? 'Lengkapi Foto Bukti' : 'Berita Acara Digital'}
                        </h2>
                        {editId && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {editId.split('-')[0]}...</span>}
                    </div>
                    <button onClick={handleReset} style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '50%' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* BODY GRID */}
                <div className="modal-body-grid" style={{ display: 'grid', gridTemplateColumns: editId ? '1fr' : 'minmax(250px, 1fr) minmax(300px, 1fr) minmax(250px, 1fr)', padding: '1.25rem', gap: '1.25rem' }}>
                    
                    {/* KOLOM 1: FORM IDENTITAS (Hanya muncul jika bukan mode edit foto) */}
                    <div style={{ display: editId ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>TANGGAL</label>
                            <input type="date" className="input" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>PENGIRIM</label>
                            <input type="text" className="input" placeholder="SUKSES DIGIMED" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>ALAMAT</label>
                            <textarea className="input" rows={2} placeholder="Alamat lengkap..." value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>EKSPEDISI</label>
                                <input type="text" className="input" placeholder="JNT/JNE" value={expedition} onChange={(e) => setExpedition(e.target.value)} />
                            </div>
                            <div>
                                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>KURIR</label>
                                <input type="text" className="input" placeholder="Nama Kurir" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* KOLOM 2: KAMERA & VISUAL (Selalu Muncul) */}
                    <div style={{ 
                        background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', 
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                            <Camera size={18} color="var(--primary)" />
                            {photoBase64 ? 'HASIL JEPRETAN (+WATERMARK)' : 'KAMERA BUKTI FISIK'}
                        </div>
                        
                        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: '300px' }}>
                            {photoBase64 ? (
                                <img src={photoBase64} alt="Bukti Resi" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : isCameraActive ? (
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ color: '#fff', textAlign: 'center', padding: '2rem' }}>
                                    <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                    <p style={{ fontWeight: 600 }}>Kamera Off</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>Tekan "Buka Kamera" di bawah.</p>
                                </div>
                            )}
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', background: '#fff' }}>
                            {photoBase64 ? (
                                <button type="button" onClick={() => { setPhotoBase64(null); startCamera(); }} className="btn btn-outline" style={{ width: '100%', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                                    <RefreshCw size={18} /> Ambil Ulang Foto
                                </button>
                            ) : isCameraActive ? (
                                <button type="button" onClick={captureAndWatermark} className="btn btn-primary" style={{ width: '100%', fontWeight: 800 }}>
                                    JEPRET & MASANG WATERMARK
                                </button>
                            ) : (
                                <button type="button" onClick={startCamera} className="btn btn-outline" style={{ width: '100%', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                    <Camera size={18} /> Buka Kamera Disini
                                </button>
                            )}
                        </div>
                    </div>

                    {/* KOLOM 3: SELECTOR RESI (Sembunyi mode edit) */}
                    <div style={{ display: editId ? 'none' : 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>RIWAYAT SCAN KELUAR</label>
                            <input type="date" className="input" value={scanDate} onChange={(e) => setScanDate(e.target.value)} style={{ padding: '0.4rem', marginBottom: '0.5rem' }} />
                            <div style={{ position: 'relative' }}>
                                <input type="text" className="input" placeholder="Cari Resi..." value={searchResi} onChange={(e) => setSearchResi(e.target.value)} style={{ padding: '0.4rem 0.4rem 0.4rem 2rem' }} />
                                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.4rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <button onClick={handleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-main)', padding: '0.2rem' }} disabled={filteredResi.length === 0}>
                                {isAllSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                                <span style={{ fontSize: '0.8rem' }}>Semua</span>
                            </button>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {selectedResi.size} Resi
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem', background: '#fff' }}>
                            {loadingResi ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto' }} />
                                </div>
                            ) : filteredResi.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Kosong</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {filteredResi.map((item) => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => toggleResi(item.resi)}
                                            style={{ 
                                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem', 
                                                borderRadius: '4px', cursor: 'pointer',
                                                background: selectedResi.has(item.resi) ? '#f0f9ff' : 'transparent',
                                                border: selectedResi.has(item.resi) ? '1px solid #bae6fd' : '1px solid transparent'
                                            }}
                                        >
                                            {selectedResi.has(item.resi) ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--border)" />}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.resi}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.scanned_time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: '1 1 200px', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {errorMsg && <><AlertCircle size={14} /> {errorMsg}</>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '300px' }}>
                        <button onClick={handleReset} className="btn" style={{ flex: 1, background: '#e2e8f0', color: '#475569' }} disabled={saving}>Batal</button>
                        <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ flex: 2, fontWeight: 800 }}>
                            {saving ? <RefreshCw className="animate-spin" size={20} /> : (editId ? 'UPDATE FOTO' : 'SIMPAN BERKAS')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
