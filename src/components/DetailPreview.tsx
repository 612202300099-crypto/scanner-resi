/**
 * DetailPreview - Component untuk preview detail berita acara
 * Menampilkan: info lengkap, foto + watermark, resi list
 */

import { Eye, Image as ImageIcon, Lock } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

interface DeliveryNoteDetail {
  id: string;
  note_date: string;
  sender_name: string;
  sender_address: string;
  expedition: string;
  courier_name?: string | null;
  items: string[];
  user_name: string;
  created_at: string;
  photo_data?: string | null;
  is_finalized?: boolean;
  photo_source?: 'camera' | 'gallery';
}

interface DetailPreviewProps {
  note: DeliveryNoteDetail;
  onClose: () => void;
  onEdit?: () => void;
  onFinalize?: () => void;
  isFinalizing?: boolean;
}

export default function DetailPreview({
  note,
  onClose,
  onEdit,
  onFinalize,
  isFinalizing = false,
}: DetailPreviewProps) {
  const createdAtFormatted = dayjs(note.created_at).format('DD MMM YYYY - HH:mm');
  const noteDate = dayjs(note.note_date).format('dddd, DD MMMM YYYY');

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
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '700px',
          maxHeight: '95vh',
          overflowY: 'auto',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Eye size={20} color="var(--primary)" />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>
                Preview Berita Acara
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {createdAtFormatted}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: '#f1f5f9',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Status badge */}
        {note.is_finalized && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              background: '#dcfce7',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Lock size={16} />
            Dokumen sudah di-finalisasi (tidak bisa diedit)
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '1.25rem', flex: 1 }}>
          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Tanggal */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                📅 TANGGAL BERITA ACARA
              </label>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                {noteDate}
              </p>
            </div>

            {/* User */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                👤 DIBUAT OLEH
              </label>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                {note.user_name}
              </p>
            </div>
          </div>

          {/* Pengirim Info */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  📦 PENGIRIM
                </label>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  {note.sender_name || '—'}
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  🚚 EKSPEDISI
                </label>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  {note.expedition || '—'}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  👨‍💼 KURIR
                </label>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  {note.courier_name || 'Belum diisi'}
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  📍 JUMLAH PAKET
                </label>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary)' }}>
                  {note.items.length} Resi
                </p>
              </div>
            </div>
          </div>

          {/* Alamat */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              🏠 ALAMAT PENGIRIM
            </label>
            <div
              style={{
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {note.sender_address || 'Belum diisi'}
            </div>
          </div>

          {/* Daftar Resi */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              📋 DAFTAR RESI ({note.items.length})
            </label>
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {note.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {note.items.map((resi, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: idx < note.items.length - 1 ? '1px solid var(--border)' : 'none',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                      }}
                    >
                      <span style={{ color: 'var(--primary)', fontWeight: 800 }}>#{idx + 1}</span> {resi}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Belum ada resi
                </div>
              )}
            </div>
          </div>

          {/* Foto */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              📸 FOTO BUKTI + WATERMARK
            </label>
            {note.photo_data ? (
              <div
                style={{
                  border: '2px solid var(--primary)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#000',
                  maxHeight: '400px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={note.photo_data}
                  alt="Bukti Resi"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                }}
              >
                <ImageIcon size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Belum ada foto</p>
              </div>
            )}
          </div>

          {/* Photo source info */}
          {note.photo_data && (
            <div
              style={{
                padding: '0.75rem',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#1e40af',
                marginBottom: '1.5rem',
              }}
            >
              ℹ️ Foto diambil dari: <strong>{note.photo_source === 'gallery' ? 'Galeri' : 'Kamera'}</strong>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        <div
          style={{
            padding: '1.25rem',
            borderTop: '1px solid var(--border)',
            background: '#f8fafc',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="btn"
            style={{ background: '#e2e8f0', color: '#475569' }}
          >
            Tutup
          </button>

          {!note.is_finalized && onEdit && (
            <button onClick={onEdit} className="btn btn-outline">
              ✏️ Edit
            </button>
          )}

          {!note.is_finalized && onFinalize && (
            <button
              onClick={onFinalize}
              className="btn btn-primary"
              disabled={isFinalizing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 800,
              }}
            >
              {isFinalizing ? (
                <>⏳ Finalizing...</>
              ) : (
                <>
                  <Lock size={16} /> Finalisasi
                </>
              )}
            </button>
          )}

          {note.is_finalized && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#dcfce7',
                color: '#166534',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              <Lock size={16} /> TERKUNCI
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
