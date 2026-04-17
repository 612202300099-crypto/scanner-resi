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
            fetchResi();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, scanDate]);

    const fetchResi = async () => {
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
            setIsCameraActive(true);
            setPhotoBase64(null);
        } catch (err: any) {
            alert('Akses Kamera Terblokir atau Tidak Ditemukan: ' + err.message);
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
        if (!senderName.trim() || !senderAddress.trim() || !expedition.trim()) {
            setErrorMsg('Harap lengkapi Nama Pengirim, Alamat, dan Ekspedisi.');
            return;
        }
        if (selectedResi.size === 0) {
            setErrorMsg('Harap pilih minimal 1 resi untuk dimasukkan ke Berita Acara.');
            return;
        }
        if (!photoBase64) {
            setErrorMsg('Harap lampirkan Foto Bukti fisik dengan menekan tombol Kamera.');
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
                photo_data: photoBase64,
                user_id: user?.id,
                user_name: userName
            };

            const { error } = await supabase.from('delivery_notes').insert([payload]);
            if (error) throw error;

            onSuccess();
            handleReset();
        } catch (error: any) {
            console.error('Error saving delivery note:', error);
            setErrorMsg(error.message || 'Terjadi kesalahan sistem saat menyimpan. Jika kebesaran, coba dekatkan kamera agar fokus.');
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
        setPhotoBase64(null);
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
            <div className="card" style={{ 
                width: '100%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', padding: '0'
            }}>
                {/* HEAD */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>Berita Acara Digital (Lengkap Foto Bukti)</h2>
                    <button onClick={handleReset} style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '50%' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                {/* BODY GRID: Form | Kamera | Selector */}
                <div className="mobile-flex-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(300px, 1fr) minmax(250px, 1fr)', padding: '1.5rem', gap: '1.5rem' }}>
                    
                    {/* KOLOM 1: FORM IDENTITAS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>TANGGAL (Di Dokumen)</label>
                            <input type="date" className="input" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>NAMA PENGIRIM</label>
                            <input type="text" className="input" placeholder="SUKSES DIGIMED..." value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>ALAMAT PENGIRIM</label>
                            <textarea className="input" rows={2} placeholder="Jl. Kantil..." value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} style={{ resize: 'vertical' }} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>EKSPEDISI</label>
                            <input type="text" className="input" placeholder="JNT, JNE..." value={expedition} onChange={(e) => setExpedition(e.target.value)} />
                        </div>
                        <div>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>NAMA KURIR (OPSIONAL)</label>
                            <input type="text" className="input" placeholder="Misal: Budi / JNT Grogol" value={courierName} onChange={(e) => setCourierName(e.target.value)} />
                        </div>
                    </div>

                    {/* KOLOM 2: KAMERA & VISUAL */}
                    <div style={{ 
                        background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', 
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                            <Camera size={20} color="var(--primary)" />
                            FOTO FISIK + WATERMARK
                        </div>
                        
                        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', minHeight: '300px' }}>
                            {photoBase64 ? (
                                <img src={photoBase64} alt="Bukti Resi" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : isCameraActive ? (
                                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                                    <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>Foto belum diambil.</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Tekan Buka Kamera untuk melihat Viewfinder.</p>
                                </div>
                            )}
                            
                            {/* Hidden Element untuk meracik kompresi & watermark */}
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>

                        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid var(--border)', background: '#fff' }}>
                            {photoBase64 ? (
                                <button type="button" onClick={() => { setPhotoBase64(null); startCamera(); }} className="btn btn-outline" style={{ width: '100%', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                                    <RefreshCw size={18} /> Foto Ulang Bukti
                                </button>
                            ) : isCameraActive ? (
                                <button type="button" onClick={captureAndWatermark} className="btn btn-primary" style={{ width: '100%', fontSize: '1.1rem', letterSpacing: '1px' }}>
                                    📸 JEPRET SEKARANG
                                </button>
                            ) : (
                                <button type="button" onClick={startCamera} className="btn btn-outline" style={{ width: '100%', color: 'var(--primary)', borderColor: 'var(--primary)', background: '#f0f9ff' }}>
                                    <Camera size={18} /> Buka Kamera Disini
                                </button>
                            )}
                        </div>
                    </div>

                    {/* KOLOM 3: SELECTOR RESI */}
                    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <label className="input-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 800 }}>PILIH PAKET (KELUAR)</label>
                            <input type="date" className="input" value={scanDate} onChange={(e) => setScanDate(e.target.value)} style={{ padding: '0.5rem', marginBottom: '0.5rem' }} />
                            <div style={{ position: 'relative' }}>
                                <input type="text" className="input" placeholder="Cari Resi Cepat..." value={searchResi} onChange={(e) => setSearchResi(e.target.value)} style={{ padding: '0.5rem', paddingLeft: '2rem' }} />
                                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                            <button onClick={handleSelectAll} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-main)', padding: '0.5rem' }} disabled={filteredResi.length === 0}>
                                {isAllSelected ? <CheckSquare size={18} color="var(--primary)" /> : <Square size={18} color="var(--text-muted)" />}
                                Select All
                            </button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
                                {selectedResi.size} Terpilih
                            </span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', background: '#fff' }}>
                            {loadingResi ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
                                    Loading...
                                </div>
                            ) : filteredResi.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Kosong.
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
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.resi}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.scanned_time}</div>
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
                        <button onClick={handleSave} className="btn btn-primary" disabled={saving || !photoBase64 || selectedResi.size === 0} style={{ padding: '0.75rem 2rem', opacity: (!photoBase64 || selectedResi.size === 0) ? 0.5 : 1 }}>
                            {saving ? <RefreshCw className="animate-spin" size={20} /> : 'Simpan Data Lengkap'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
