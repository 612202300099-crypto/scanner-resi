/**
 * DeliveryNoteModal - Main Modal Component
 * Refactored: Clean architecture with child components
 * Features: Create, Edit, Gallery + Camera, Finalize (lock)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import { X, Search, CheckSquare, Square, RefreshCw, AlertCircle } from 'lucide-react';
import PhotoCapture from './PhotoCapture';

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
    photo_data?: string;
    is_finalized?: boolean;
  } | null;
}

export default function DeliveryNoteModal({
  isOpen,
  onClose,
  onSuccess,
  editId,
  initialData,
}: DeliveryNoteModalProps) {
  // Form State
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

  // Photo State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'camera' | 'gallery'>('camera');

  // UI State
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // Initialize modal
  useEffect(() => {
    if (isOpen) {
      if (editId && initialData) {
        // Mode: Edit existing
        setIsEditMode(true);
        setNoteDate(initialData.note_date);
        setSenderName(initialData.sender_name);
        setSenderAddress(initialData.sender_address);
        setExpedition(initialData.expedition);
        setCourierName(initialData.courier_name || '');
        setSelectedResi(new Set(initialData.items));
        setPhotoBase64(initialData.photo_data || null);
        setIsFinalized(initialData.is_finalized || false);
        setAvailableResi([]);
      } else {
        // Mode: Create new
        handleReset();
        fetchResi();
      }
    }

    return () => {
      // Cleanup on unmount
    };
  }, [isOpen, scanDate, editId, initialData]);

  const handleReset = () => {
    setNoteDate(dayjs().format('YYYY-MM-DD'));
    setSenderName('');
    setSenderAddress('');
    setExpedition('');
    setCourierName('');
    setSelectedResi(new Set());
    setSearchResi('');
    setPhotoBase64(null);
    setPhotoSource('camera');
    setErrorMsg('');
    setIsEditMode(false);
    setIsFinalized(false);
  };

  // Fetch resi untuk hari yang dipilih
  const fetchResi = async () => {
    if (editId || isEditMode) return; // Jangan fetch di mode edit
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
      setErrorMsg('Gagal mengambil data resi: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingResi(false);
    }
  };

  const handleSelectAll = () => {
    const currentFiltered = availableResi.filter((item) =>
      item.resi.toLowerCase().includes(searchResi.toLowerCase())
    );
    const allSelected = currentFiltered.every((item) => selectedResi.has(item.resi));

    const newSelected = new Set(selectedResi);
    if (allSelected) {
      currentFiltered.forEach((item) => newSelected.delete(item.resi));
    } else {
      currentFiltered.forEach((item) => newSelected.add(item.resi));
    }
    setSelectedResi(newSelected);
  };

  const toggleResi = (resi: string) => {
    if (isEditMode && !editId) return; // Prevent edit mode without editId
    const newSelected = new Set(selectedResi);
    if (newSelected.has(resi)) {
      newSelected.delete(resi);
    } else {
      newSelected.add(resi);
    }
    setSelectedResi(newSelected);
  };

  // Save handler
  const handleSave = async () => {
    setErrorMsg('');

    // Validate required fields
    if (!isEditMode) {
      if (!senderName.trim() || !senderAddress.trim() || !expedition.trim()) {
        setErrorMsg('Harap lengkapi: Nama Pengirim, Alamat, dan Ekspedisi.');
        return;
      }
      if (selectedResi.size === 0) {
        setErrorMsg('Harap pilih minimal 1 resi untuk dimasukkan ke Berita Acara.');
        return;
      }
    }

    // If edit mode, photo harus ada
    if (isEditMode && !photoBase64) {
      setErrorMsg('Harap ambil atau pilih foto bukti terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserName = userData.user?.user_metadata?.full_name || userData.user?.email?.split('@')[0] || 'User Lapangan';

      if (isEditMode && editId) {
        // UPDATE mode: Update photo, user, timestamp
        const updatePayload: any = {
          photo_data: photoBase64,
          photo_source: photoSource,
          updated_at: new Date().toISOString(),
          user_name: currentUserName,
        };

        const { error } = await supabase
          .from('delivery_notes')
          .update(updatePayload)
          .eq('id', editId);

        if (error) throw error;
      } else {
        // CREATE mode
        const payload = {
          note_date: noteDate,
          sender_name: senderName,
          sender_address: senderAddress,
          expedition: expedition,
          courier_name: courierName || null,
          items: Array.from(selectedResi),
          photo_data: photoBase64 || null,
          photo_source: photoSource,
          user_id: userData.user?.id,
          user_name: currentUserName,
          is_finalized: false,
        };

        const { error } = await supabase.from('delivery_notes').insert([payload]);

        if (error) throw error;
      }

      onSuccess();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving delivery note:', error);
      setErrorMsg(error.message || 'Terjadi kesalahan sistem saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  // Finalize (lock) handler
  const handleFinalize = async () => {
    if (!editId) return;

    const confirmed = window.confirm(
      'Yakin ingin mem-finalisasi dokumen ini?\n\nSetelah ini dokumen TIDAK BISA DIEDIT lagi.'
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('delivery_notes')
        .update({ is_finalized: true })
        .eq('id', editId);

      if (error) throw error;

      setIsFinalized(true);
      setErrorMsg('');
      onSuccess();
    } catch (error: any) {
      console.error('Error finalizing delivery note:', error);
      setErrorMsg(error.message || 'Gagal mem-finalisasi dokumen.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  const filteredResi = availableResi.filter((item) =>
    item.resi.toLowerCase().includes(searchResi.toLowerCase())
  );
  const isAllSelected = filteredResi.length > 0 && filteredResi.every((item) => selectedResi.has(item.resi));
  const isReadOnly = isFinalized;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
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

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: isEditMode ? '600px' : '1200px',
          maxHeight: '95vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
              {isEditMode ? (isReadOnly ? '📋 Lihat Berita Acara (Terkunci)' : '✏️ Edit Berita Acara') : 'Berita Acara Digital'}
            </h2>
            {isReadOnly && <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>🔒 Dokumen tidak bisa diedit</span>}
          </div>
          <button
            onClick={handleCloseModal}
            style={{
              padding: '0.5rem',
              background: '#f1f5f9',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {/* BODY */}
        <div
          className="modal-body-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: isEditMode ? '1fr' : 'minmax(250px, 1fr) minmax(300px, 1fr) minmax(250px, 1fr)',
            padding: '1.25rem',
            gap: '1.25rem',
            flex: 1,
          }}
        >
          {/* KOLOM 1: FORM IDENTITAS (hidden di mode edit) */}
          {!isEditMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                  TANGGAL
                </label>
                <input type="date" className="input" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
              </div>
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                  PENGIRIM
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="SUKSES DIGIMED"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                  ALAMAT
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Alamat lengkap..."
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                    EKSPEDISI
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="JNT/JNE"
                    value={expedition}
                    onChange={(e) => setExpedition(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                    KURIR
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Nama Kurir"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          )}

          {/* KOLOM 2: KAMERA & VISUAL */}
          <div style={{ gridColumn: isEditMode ? '1 / -1' : 'auto' }}>
            <PhotoCapture
              photoBase64={photoBase64}
              setPhotoBase64={setPhotoBase64}
              photoSource={photoSource}
              setPhotoSource={setPhotoSource}
              senderName={senderName}
              senderAddress={senderAddress}
              expedition={expedition}
              courierName={courierName}
              selectedResiCount={selectedResi.size}
              isLoading={saving}
            />
          </div>

          {/* KOLOM 3: SELECTOR RESI (hidden di mode edit) */}
          {!isEditMode && (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 800 }}>
                  RIWAYAT SCAN KELUAR
                </label>
                <input
                  type="date"
                  className="input"
                  value={scanDate}
                  onChange={(e) => setScanDate(e.target.value)}
                  style={{ padding: '0.4rem', marginBottom: '0.5rem' }}
                />
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Cari Resi..."
                    value={searchResi}
                    onChange={(e) => setSearchResi(e.target.value)}
                    style={{ padding: '0.4rem 0.4rem 0.4rem 2rem' }}
                  />
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.4rem', background: '#f8fafc', borderRadius: '8px' }}>
                <button
                  onClick={handleSelectAll}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    padding: '0.2rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  disabled={filteredResi.length === 0}
                >
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
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Kosong
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {filteredResi.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleResi(item.resi)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.4rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: selectedResi.has(item.resi) ? '#f0f9ff' : 'transparent',
                          border: selectedResi.has(item.resi) ? '1px solid #bae6fd' : '1px solid transparent',
                        }}
                      >
                        {selectedResi.has(item.resi) ? (
                          <CheckSquare size={16} color="var(--primary)" />
                        ) : (
                          <Square size={16} color="var(--border)" />
                        )}
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
          )}
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '1.25rem',
            borderTop: '1px solid var(--border)',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ flex: '1 1 200px', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {errorMsg && (
              <>
                <AlertCircle size={14} /> {errorMsg}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
            <button
              onClick={handleCloseModal}
              className="btn"
              style={{ flex: 1, background: '#e2e8f0', color: '#475569' }}
              disabled={saving}
            >
              Batal
            </button>

            {isReadOnly ? (
              <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontWeight: 800, fontSize: '0.85rem' }}>
                🔒 TERKUNCI
              </div>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ flex: isEditMode ? 1 : 2, fontWeight: 800 }}
                >
                  {saving ? <RefreshCw className="animate-spin" size={20} /> : isEditMode ? '💾 UPDATE FOTO' : '💾 SIMPAN BERKAS'}
                </button>

                {isEditMode && (
                  <button
                    onClick={handleFinalize}
                    className="btn"
                    style={{
                      background: '#fef08a',
                      color: '#713f12',
                      flex: 1,
                      fontWeight: 800,
                    }}
                    disabled={saving}
                  >
                    🔒 FINALISASI
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
