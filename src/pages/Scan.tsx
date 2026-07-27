import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { Camera, Keyboard, AlertCircle, CheckCircle2, RefreshCw, Layers, WifiOff, UploadCloud } from 'lucide-react';
import { matchScanToOrderItem, markItemAsShipped } from '../services/destyService';

dayjs.locale('id');
const HARI_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// FUNGSI AUDIO TINGKAT DEWA (Tanpa File Mp3)
const emitSound = (type: 'success' | 'error') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            // Bunyi Ting! Melengking Halus
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } else {
            // Bunyi Teet Toot! Kasar
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) { console.error('Audio Sensor Not Supported', e) }
}

export default function Scan() {
    const [useCamera, setUseCamera] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: React.ReactNode } | null>(null);
    const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
    const [cameraErrorMsg, setCameraErrorMsg] = useState('');

    // KONTROL ALUR PAKET
    const [scanStatus, setScanStatus] = useState<'MASUK' | 'KELUAR' | 'RETUR'>('MASUK');
    const scanStatusRef = useRef<'MASUK' | 'KELUAR' | 'RETUR'>('MASUK'); // Penyelamat Stale Closure Bug

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [syncing, setSyncing] = useState(false);
    const [offlineCount, setOfflineCount] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // KONEKTIVITAS OFFLINE SENSOR
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        updateOfflineCount();
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // SINKRONISASI DATA TERTUNDA OTOMATIS
    useEffect(() => {
        if (!isOffline && offlineCount > 0 && !syncing) {
            syncOfflineData();
        }
    }, [isOffline, offlineCount]);

    const updateOfflineCount = () => {
        const queue = JSON.parse(localStorage.getItem('offline_scans') || '[]');
        setOfflineCount(queue.length);
    };

    const syncOfflineData = async () => {
        setSyncing(true);
        const queue = JSON.parse(localStorage.getItem('offline_scans') || '[]');
        if (queue.length === 0) {
            setSyncing(false);
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Auth Hilang');

            // Format ulang untuk Supabase bulk insert
            const payloads = queue.map((q: any) => ({
                resi: q.resi,
                status: q.status,
                scanned_at: q.scanned_at,
                scanned_date: q.scanned_date,
                scanned_time: q.scanned_time,
                scanned_day: q.scanned_day,
                user_id: user.id,
                user_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User Karantina'
            }));

            // Upsert / Insert ignore dengan supabase insert menembak ganda
            const { error } = await supabase.from('scans').insert(payloads);
            // Kalau gagal insert mungkin sebagian duplikat, tidak apa-apa ini versi bulk.

            if (!error || error.code === '23505') {
                // Bersihkan antrian jika sukses atau murni sekedar duplikat
                localStorage.removeItem('offline_scans');
                setOfflineCount(0);
                showNotification('success', `Awan Terhubung! ${queue.length} Resi Tertunda Berhasil Disuntik ke Server Absolut.`);
                emitSound('success');
            }
        } catch (e: any) {
            console.error('Sync Gagal', e);
        } finally {
            setSyncing(false);
        }
    };

    const stopCamera = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) { }
            scannerRef.current = null;
        }
    };

    const startCamera = async () => {
        setCameraState('starting');
        setCameraErrorMsg('');
        try {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 250, height: 250 } },
                (decodedText) => handleScanSuccess(decodedText),
                () => { }
            );
            setCameraState('active');
        } catch (err: any) {
            let errMsg = "Akses terblokir. Pastikan kamera menyala dan Izin diberikan di browser.";
            setCameraErrorMsg(errMsg);
            setCameraState('error');
        }
    };

    useEffect(() => {
        if (!useCamera) {
            stopCamera().then(() => {
                setCameraState('idle');
                inputRef.current?.focus();
            });
        } else {
            startCamera();
        }
        return () => { stopCamera(); };
    }, [useCamera]);

    const showNotification = (type: 'success' | 'error', message: React.ReactNode) => {
        setNotification({ type, message });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            setNotification(null);
            if (!useCamera && inputRef.current) inputRef.current.focus();
        }, 4000);
    };

    const handleScanSuccess = (decodedText: string) => {
        processBarcode(decodedText);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') processBarcode(inputValue);
    };

    const processBarcode = async (barcode: string) => {
        if (isProcessing || !barcode.trim()) return;
        setIsProcessing(true);
        setInputValue('');
        if (useCamera && scannerRef.current?.isScanning) scannerRef.current.pause(true);

        const cleanBarcode = barcode.trim();
        const currentActiveStatus = scanStatusRef.current; // GUNAKAN REF BUKAN STATE!

        const now = new Date();
        const current_scanned_date = dayjs(now).format('YYYY-MM-DD');
        const current_scanned_time = dayjs(now).format('HH:mm:ss');
        const current_scanned_day = HARI_INDO[now.getDay()];

        try {
            // MODE OFFLINE DETECTOR: Jika internet putus, tangkap ke memori localStorage
            if (isOffline) {
                const queue = JSON.parse(localStorage.getItem('offline_scans') || '[]');
                const isDupInQueue = queue.find((q: any) => q.resi === cleanBarcode && q.status === currentActiveStatus);
                if (isDupInQueue) {
                    emitSound('error');
                    showNotification('error', `Duplikat Offline: Resi [${cleanBarcode}] sudah masuk antrian dengan Status [${currentActiveStatus}].`);
                } else {
                    queue.push({
                        resi: cleanBarcode, status: currentActiveStatus,
                        scanned_at: now.toISOString(), scanned_date: current_scanned_date,
                        scanned_time: current_scanned_time, scanned_day: current_scanned_day
                    });
                    localStorage.setItem('offline_scans', JSON.stringify(queue));
                    updateOfflineCount();
                    emitSound('success');
                    showNotification('success', (<div><div style={{ fontWeight: 800, color: '#f59e0b' }}>TERTAMPUNG DARURAT OFFLINE</div><div>{cleanBarcode} ({currentActiveStatus})</div></div>));
                }
            } else {
                // MODE ONLINE: Cek Duplikat Absolut berdasarkan (Resi + Status)
                const { data: existingData } = await supabase
                    .from('scans')
                    .select('*')
                    .eq('resi', cleanBarcode)
                    .eq('status', currentActiveStatus)
                    .maybeSingle();

                if (existingData) {
                    emitSound('error');
                    showNotification('error', (
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '0.2rem', color: '#991b1b' }}>DUPLIKAT ALUR STATUS!</div>
                            <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                                Resi: <strong>{existingData.resi}</strong> sudah di-scan sbg <strong>{existingData.status}</strong><br />
                                Pelaku: <strong>{existingData.user_name}</strong><br />
                                Waktu: {existingData.scanned_day}, {dayjs(existingData.scanned_date).format('DD MMM')} - {existingData.scanned_time} WIB
                            </div>
                        </div>
                    ));
                } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User Lapangan';

                    const { error: insertError } = await supabase.from('scans').insert({
                        resi: cleanBarcode, status: currentActiveStatus, scanned_at: now.toISOString(),
                        scanned_date: current_scanned_date, scanned_time: current_scanned_time,
                        scanned_day: current_scanned_day, user_id: user?.id, user_name: userName
                    });

                    if (insertError) throw insertError;

                    emitSound('success');
                    
                    // DESTY INTEGRATION: Auto-match scan dengan order marketplace
                    let destyMatchMsg: React.ReactNode = null;
                    if (currentActiveStatus === 'KELUAR') {
                        try {
                            const match = await matchScanToOrderItem(cleanBarcode);
                            if (match) {
                                // Dapatkan scan ID untuk linking
                                const { data: scanData } = await supabase
                                    .from('scans')
                                    .select('id')
                                    .eq('resi', cleanBarcode)
                                    .eq('status', 'KELUAR')
                                    .order('scanned_at', { ascending: false })
                                    .limit(1)
                                    .single();
                                
                                if (scanData) {
                                    await markItemAsShipped(match.orderItem.id, scanData.id);
                                }
                                destyMatchMsg = (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}>
                                        <div style={{ fontWeight: 700, color: '#1e40af' }}>🔗 TERHUBUNG DENGAN ORDER DESTY!</div>
                                        <div>🛒 {match.order.platform_name}: <strong>{match.order.order_sn}</strong></div>
                                        <div>📦 {match.orderItem.item_name} (x{match.orderItem.quantity})</div>
                                        <div>👤 {match.order.customer_name} • 📍 {match.order.shipping_city}</div>
                                        <div style={{ marginTop: '0.25rem', color: '#16a34a', fontWeight: 700 }}>✅ Otomatis ditandai sebagai TERKIRIM</div>
                                    </div>
                                );
                            }
                        } catch (destyErr) {
                            console.log('Desty matching skipped (not an error):', destyErr);
                        }
                    }

                    showNotification('success', (
                        <div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065f46' }}>BERHASIL MENDUDA</div>
                            <div style={{ fontSize: '1rem' }}>Resi <strong>{cleanBarcode}</strong> - Posisi <strong>{currentActiveStatus}</strong></div>
                            {destyMatchMsg}
                        </div>
                    ));
                }
            }
        } catch (error: any) {
            emitSound('error');
            showNotification('error', `Gagal Eksekusi: Jaringan Putus/Terjadi Crash Server. [${error?.message || 'Unknown'}]`);
        } finally {
            setIsProcessing(false);
            if (useCamera && scannerRef.current) {
                setTimeout(() => { if (scannerRef.current?.isScanning) scannerRef.current.resume(); }, 800);
            } else if (!useCamera && inputRef.current) {
                inputRef.current.focus();
            }
        }
    };

    return (
        <div>
            <div className="mobile-flex-col" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Terminal Senjata Scan</h1>
                {/* WIDGET KONEKSI INTERNET ENTERPRISE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {offlineCount > 0 && (
                        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#d97706', padding: '0.5rem 1rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.875rem' }}>
                            {syncing ? <RefreshCw size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            {offlineCount} Resi Tertunda
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 1rem', borderRadius: '8px', background: isOffline ? '#fef2f2' : '#ecfdf5', color: isOffline ? '#ef4444' : '#10b981', fontWeight: 900, border: `1px solid ${isOffline ? '#fca5a5' : '#6ee7b7'}` }}>
                        {isOffline ? <WifiOff size={18} /> : <span>🟢</span>}
                        {isOffline ? 'KONEKSI PUTUS (OTOMATIS TAMPUNG BERKAS)' : 'SISTEM ONLINE KAWALAN PENUH'}
                    </div>
                </div>
            </div>

            {/* TAB MODE & ALUR BARANG */}
            <div className="responsive-grid" style={{ marginBottom: '1.5rem' }}>

                {/* Kamera vs Keyboard Mod */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textAlign: 'center', margin: '0.2rem 0' }}>HARDWARE PEMISAI</div>
                    <button className={`btn ${!useCamera ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUseCamera(false)} style={{ padding: '0.75rem', border: 'none' }}>
                        <Keyboard size={20} /> Laser Pistol Fisik
                    </button>
                    <button className={`btn ${useCamera ? 'btn-primary' : 'btn-outline'}`} onClick={() => setUseCamera(true)} style={{ padding: '0.75rem', border: 'none' }}>
                        <Camera size={20} /> Lensa Kamera AI
                    </button>
                </div>

                {/* Pilih Status Alur */}
                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={18} color="var(--primary)" />
                        POSISI BARANG YANG SEDANG DI-SCAN SEKARANG:
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        {['MASUK', 'KELUAR', 'RETUR'].map((st) => (
                            <button key={st} onClick={() => {
                                setScanStatus(st as any);
                                scanStatusRef.current = st as any;
                                if (!useCamera) inputRef.current?.focus();
                            }}
                                style={{
                                    flex: 1, padding: '0.75rem', borderRadius: '8px', fontWeight: 900, cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem',
                                    border: scanStatus === st ? `2px solid ${st === 'RETUR' ? '#ef4444' : st === 'KELUAR' ? '#10b981' : '#0ea5e9'}` : '1px solid var(--border)',
                                    background: scanStatus === st ? (st === 'RETUR' ? '#fef2f2' : st === 'KELUAR' ? '#ecfdf5' : '#e0f2fe') : 'transparent',
                                    color: scanStatus === st ? (st === 'RETUR' ? '#b91c1c' : st === 'KELUAR' ? '#047857' : '#0369a1') : 'var(--text-muted)'
                                }}>
                                {st}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Area Notifikasi Mengambang */}
            <div style={{ minHeight: '90px', marginBottom: '1.5rem' }}>
                {notification && (
                    <div className={`alert ${notification.type === 'error' ? 'alert-danger' : 'alert-success'}`} style={{
                        margin: 0, padding: '1.25rem', borderLeftWidth: '8px', borderLeftStyle: 'solid',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center',
                        transform: 'scale(1)', transition: 'transform 0.2s'
                    }}>
                        {notification.type === 'error' ? <AlertCircle size={40} style={{ marginRight: '1rem' }} /> : <CheckCircle2 size={40} style={{ marginRight: '1rem' }} />}
                        <div style={{ flex: 1 }}>{notification.message}</div>
                    </div>
                )}
            </div>

            {/* KOTAK TEMBAKAN */}
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '0', overflow: 'hidden', border: `3px solid ${scanStatus === 'RETUR' ? '#fca5a5' : scanStatus === 'KELUAR' ? '#6ee7b7' : '#7dd3fc'}` }}>
                {/* Header Status Tertanda Ekstra Jelas */}
                <div style={{ backgroundColor: scanStatus === 'RETUR' ? '#b91c1c' : scanStatus === 'KELUAR' ? '#047857' : '#0369a1', padding: '1rem', color: 'white' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '2px' }}>
                        MODE TEMBAKAN: {scanStatus}
                    </h2>
                </div>

                <div className="mobile-padding-1" style={{ padding: '3rem 2rem', background: '#f8fafc' }}>
                    {!useCamera ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <input
                                ref={inputRef} type="text" className="input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} disabled={isProcessing}
                                placeholder="Klik kursor disini & mulai tembak barbar..."
                                style={{
                                    fontSize: '1.75rem', padding: '1.5rem', textAlign: 'center', backgroundColor: isProcessing ? '#f1f5f9' : 'white',
                                    borderWidth: '3px', borderRadius: '16px', borderBottomWidth: '8px', color: '#0f172a', fontWeight: 900, outline: 'none',
                                    borderColor: scanStatus === 'RETUR' ? '#ef4444' : scanStatus === 'KELUAR' ? '#10b981' : '#0ea5e9',
                                    boxShadow: '0 15px 30px rgba(0,0,0,0.05)', width: '100%', maxWidth: '600px'
                                }}
                                autoFocus
                            />
                            {isProcessing && (
                                <div style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <RefreshCw className="animate-spin" size={24} /> MENYELARASKAN DATA KE JARINGAN...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
                            {cameraState === 'error' ? (
                                <div style={{ padding: '2rem', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                    <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
                                    <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Perangkat Visual Diblokir</h3>
                                    <p>{cameraErrorMsg}</p>
                                    <button onClick={startCamera} className="btn btn-primary" style={{ marginTop: '1rem' }}>Restorasi Kamera</button>
                                </div>
                            ) : (
                                <>
                                    {cameraState === 'starting' && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', zIndex: 10 }}>
                                            <RefreshCw className="animate-spin" size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                            <div style={{ fontWeight: 800, color: 'var(--text-muted)' }}>MELUNCURKAN MESIN OPTIK...</div>
                                        </div>
                                    )}
                                    <div id="reader" style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: cameraState === 'active' ? `4px solid ${scanStatus === 'RETUR' ? '#ef4444' : scanStatus === 'KELUAR' ? '#10b981' : '#0ea5e9'}` : 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}></div>

                                    {isProcessing && (
                                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                                            <RefreshCw className="animate-spin" size={56} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                            <div style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--text-main)', letterSpacing: '1px' }}>MENANGKAP BUKTI...</div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
