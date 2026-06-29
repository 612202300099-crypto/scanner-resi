/**
 * PhotoService - Clean Architecture for Photo Processing
 * Handles: Camera capture, Gallery upload, Watermarking, Validation
 * Best practices: Single Responsibility, DRY, Error Handling
 */

import dayjs from 'dayjs';

interface WatermarkConfig {
  senderName: string;
  senderAddress: string;
  expedition: string;
  courierName?: string;
  resiCount: number;
  maxResolution?: number;
  quality?: number;
}

/**
 * Watermark image dengan info berita acara
 * - Responsive terhadap ukuran gambar
 * - Shadow effect untuk readability
 * - Auto-wrap untuk text panjang
 */
export const addWatermarkToImage = async (
  imageSrc: string | HTMLVideoElement,
  config: WatermarkConfig,
  canvas: HTMLCanvasElement
): Promise<string> => {
  if (!canvas) throw new Error('Canvas element tidak ditemukan');

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal mendapatkan canvas context');

  let w = 0;
  let h = 0;

  // Tentukan dimensi berdasarkan sumber
  if (imageSrc instanceof HTMLVideoElement) {
    w = imageSrc.videoWidth;
    h = imageSrc.videoHeight;
  } else if (typeof imageSrc === 'string') {
    // Load image dari base64/URL
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        processImageWithWatermark(img, canvas, config)
          .then(resolve)
          .catch(reject);
      };
      img.onerror = () => reject(new Error('Gagal load image'));
      img.src = imageSrc;
    });
  } else {
    throw new Error('Tipe sumber gambar tidak valid');
  }

  // Resize jika terlalu besar (max 1280px)
  const maxRes = config.maxResolution || 1280;
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

  // Draw video frame
  ctx.drawImage(imageSrc as HTMLVideoElement, 0, 0, w, h);

  return drawWatermarkOnCanvas(ctx, w, config);
};

/**
 * Proses image file dari galeri dengan watermark
 */
const processImageWithWatermark = async (
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  config: WatermarkConfig
): Promise<string> => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  let w = img.naturalWidth;
  let h = img.naturalHeight;

  // Resize jika terlalu besar
  const maxRes = config.maxResolution || 1280;
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

  ctx.drawImage(img, 0, 0, w, h);
  return drawWatermarkOnCanvas(ctx, w, config);
};

/**
 * Draw watermark text ke canvas
 */
const drawWatermarkOnCanvas = (
  ctx: CanvasRenderingContext2D,
  w: number,
  config: WatermarkConfig
): string => {
  // Setup shadow effect
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  const fontSize = Math.max(16, Math.floor(w / 35));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = '#fbbf24'; // Warna Kuning Amber
  ctx.textBaseline = 'top';

  const paddingLeft = fontSize;
  let currentY = fontSize;

  // Prepare text lines
  const dateStr = dayjs().format('dddd, DD MMMM YYYY - HH:mm WIB');
  const countResiStr = `Sebanyak: ${config.resiCount} Paket / Resi`;
  const senderStr = `Pengirim: ${config.senderName || 'Tanpa Nama'}`;
  const expStr = `Penerima: ${config.expedition || 'Tanpa Ekspedisi'} ${
    config.courierName ? `(${config.courierName})` : ''
  }`;

  // Draw lines
  ctx.fillText(dateStr, paddingLeft, currentY);
  currentY += fontSize * 1.5;
  ctx.fillText(expStr, paddingLeft, currentY);
  currentY += fontSize * 1.5;
  ctx.fillText(senderStr, paddingLeft, currentY);
  currentY += fontSize * 1.5;
  ctx.fillText(countResiStr, paddingLeft, currentY);
  currentY += fontSize * 1.5;

  // Address section (white color)
  ctx.fillStyle = '#ffffff';
  const addressTitle = 'Alamat Pengirim:';
  ctx.fillText(addressTitle, paddingLeft, currentY);
  currentY += fontSize * 1.2;

  // Auto-wrap address text
  const maxTextWidth = w - paddingLeft * 3;
  const words = (config.senderAddress || 'Belum diisi').split(' ');
  let line = '';

  ctx.font = `500 ${Math.max(14, fontSize - 2)}px sans-serif`;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxTextWidth && i > 0) {
      ctx.fillText(line, paddingLeft, currentY);
      line = words[i] + ' ';
      currentY += fontSize * 1.2;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, paddingLeft, currentY);

  // Export sebagai JPEG berkualitas 75% (hemat storage)
  const quality = config.quality || 0.75;
  return (ctx.canvas as HTMLCanvasElement).toDataURL('image/jpeg', quality);
};

/**
 * Validasi file dari galeri
 */
export const validatePhotoFile = (file: File, maxSizeMB: number = 5): string | null => {
  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    return `File terlalu besar (${fileSizeMB.toFixed(1)}MB > ${maxSizeMB}MB)`;
  }

  // Check MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.type)) {
    return `Format file tidak didukung. Gunakan: JPG, PNG, WEBP`;
  }

  // Check file extension (defense in depth)
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.includes(fileExt)) {
    return `Ekstensi file tidak valid`;
  }

  return null;
};

/**
 * Convert File ke base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Compress image sebelum watermark (optional optimization)
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1280,
  quality: number = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = () => reject(new Error('Gagal load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Gagal baca file'));
    reader.readAsDataURL(file);
  });
};
