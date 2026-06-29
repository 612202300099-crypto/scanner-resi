/**
 * PhotoCapture - Reusable Photo Capture Component
 * Supports: Camera, Gallery, Preview
 * Features: Toggle mode, error handling, loading state
 */

import { useRef, useState, useCallback } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import {
  addWatermarkToImage,
  validatePhotoFile,
  fileToBase64,
  formatFileSize,
} from '../services/photoService';
import dayjs from 'dayjs';

interface PhotoCaptureProps {
  photoBase64: string | null;
  setPhotoBase64: (photo: string | null) => void;
  photoSource: 'camera' | 'gallery';
  setPhotoSource: (source: 'camera' | 'gallery') => void;
  senderName: string;
  senderAddress: string;
  expedition: string;
  courierName?: string;
  selectedResiCount: number;
  isLoading?: boolean;
}

export default function PhotoCapture({
  photoBase64,
  setPhotoBase64,
  photoSource,
  setPhotoSource,
  senderName,
  senderAddress,
  expedition,
  courierName,
  selectedResiCount,
  isLoading = false,
}: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      let stream: MediaStream;
      try {
        // Try environment mode (back camera) for mobile
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        // Fallback to any available camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setIsCameraActive(true);
      setPhotoBase64(null);
      setPhotoSource('camera');

      // Delay untuk DOM siap
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => {
            console.error('Video play error:', e);
            setError('Gagal memainkan video. Periksa browser permissions.');
          });
        }
      }, 250);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError(
        `Akses Kamera Ditolak/Tidak Tersedia. ${
          err.name === 'NotAllowedError'
            ? 'Izinkan akses kamera di pengaturan browser.'
            : 'Periksa device camera.'
        }`
      );
      setIsCameraActive(false);
    }
  }, [setPhotoBase64, setPhotoSource]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Capture and watermark from camera
  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setProcessing(true);
    setError(null);

    try {
      const watermarkConfig = {
        senderName,
        senderAddress,
        expedition,
        courierName,
        resiCount: selectedResiCount,
      };

      const base64 = await addWatermarkToImage(
        videoRef.current,
        watermarkConfig,
        canvasRef.current
      );

      setPhotoBase64(base64);
      stopCamera();
      setFileInfo(`Foto dari kamera • ${dayjs().format('HH:mm')}`);
    } catch (err: any) {
      console.error('Capture error:', err);
      setError(err.message || 'Gagal mengambil foto');
    } finally {
      setProcessing(false);
    }
  }, [senderName, senderAddress, expedition, courierName, selectedResiCount, stopCamera, setPhotoBase64]);

  // Handle gallery file selection
  const handleGallerySelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setProcessing(true);

      try {
        // Validate file
        const validationError = validatePhotoFile(file);
        if (validationError) {
          setError(validationError);
          setProcessing(false);
          return;
        }

        // Convert to base64
        const fileBase64 = await fileToBase64(file);

        // Add watermark
        if (!canvasRef.current) throw new Error('Canvas tidak ditemukan');

        const watermarkConfig = {
          senderName,
          senderAddress,
          expedition,
          courierName,
          resiCount: selectedResiCount,
        };

        const watermarkedBase64 = await addWatermarkToImage(
          fileBase64,
          watermarkConfig,
          canvasRef.current
        );

        setPhotoBase64(watermarkedBase64);
        setPhotoSource('gallery');
        setFileInfo(`${file.name} • ${formatFileSize(file.size)}`);
      } catch (err: any) {
        console.error('Gallery selection error:', err);
        setError(err.message || 'Gagal memproses foto dari galeri');
      } finally {
        setProcessing(false);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [senderName, senderAddress, expedition, courierName, selectedResiCount, setPhotoBase64, setPhotoSource]
  );

  // Retake photo
  const handleRetake = useCallback(() => {
    setPhotoBase64(null);
    setFileInfo(null);
    if (photoSource === 'camera') {
      startCamera();
    }
  }, [photoBase64, photoSource, startCamera, setPhotoBase64]);

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.75rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.9rem',
        }}
      >
        <Camera size={18} color="var(--primary)" />
        {photoBase64 ? 'HASIL JEPRETAN (+WATERMARK)' : 'KAMERA BUKTI FISIK'}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: '#fee2e2',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Image preview area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          minHeight: '300px',
        }}
      >
        {photoBase64 ? (
          <img
            src={photoBase64}
            alt="Bukti Resi"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : isCameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ color: '#fff', textAlign: 'center', padding: '2rem' }}>
            <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: 600 }}>Kamera Off</p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
              Tekan salah satu tombol di bawah untuk mulai.
            </p>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* File info */}
      {fileInfo && (
        <div style={{ padding: '0.5rem 1rem', background: '#f1f5f9', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          📎 {fileInfo}
        </div>
      )}

      {/* Buttons */}
      <div
        style={{
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: photoBase64 ? '1fr 1fr' : '1fr 1fr',
          gap: '0.75rem',
          background: '#fff',
        }}
      >
        {photoBase64 ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="btn btn-outline"
              style={{
                color: 'var(--warning)',
                borderColor: 'var(--warning)',
                fontWeight: 700,
              }}
              disabled={processing}
            >
              <RefreshCw size={16} /> Ambil Ulang
            </button>
            {/* Spacer untuk layout */}
            <div />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-outline"
              style={{
                color: 'var(--primary)',
                borderColor: 'var(--primary)',
                fontWeight: 700,
              }}
              disabled={isCameraActive || processing || isLoading}
            >
              <Camera size={16} /> Kamera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline"
              style={{
                color: 'var(--primary)',
                borderColor: 'var(--primary)',
                fontWeight: 700,
              }}
              disabled={processing || isLoading}
            >
              <ImageIcon size={16} /> Galeri
            </button>
          </>
        )}

        {isCameraActive && !photoBase64 && (
          <button
            type="button"
            onClick={captureFromCamera}
            className="btn btn-primary"
            style={{ gridColumn: '1 / -1', fontWeight: 800 }}
            disabled={processing}
          >
            {processing ? (
              <>
                <RefreshCw className="animate-spin" size={16} /> Memproses...
              </>
            ) : (
              <>
                <Camera size={16} /> JEPRET & WATERMARK
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleGallerySelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}
