# 📋 Gallery Picker & Finalize Feature - Documentation

## Overview
Fitur baru untuk Berita Acara Digital yang memungkinkan:
1. **Gallery Picker**: Upload foto dari galeri device
2. **Photo Watermarking**: Auto watermark untuk kedua sumber (camera & gallery)
3. **Edit Mode**: Edit data berita acara dan update foto
4. **Finalize/Lock**: Kunci dokumen agar tidak bisa diedit lagi

---

## Architecture

### New Files Created

#### 1. **PhotoService** (`src/services/photoService.ts`)
Utility service untuk photo processing dengan fungsi:
- `addWatermarkToImage()` - Add watermark ke camera/gallery photo
- `validatePhotoFile()` - Validate file size, MIME type, extension
- `fileToBase64()` - Convert File ke base64 string
- `formatFileSize()` - Format bytes ke readable format
- `compressImage()` - Optional image compression

**Best Practices**:
- Single Responsibility: Hanya handle photo processing
- DRY: Shared watermark logic untuk camera & gallery
- Error Handling: Comprehensive error messages
- Type Safe: Full TypeScript support

#### 2. **PhotoCapture Component** (`src/components/PhotoCapture.tsx`)
Reusable component untuk capture/upload foto:
- Toggle antara Camera & Gallery modes
- Real-time preview
- Error handling dengan user feedback
- Loading state
- File info display (filename, size)

**Features**:
- ✅ Camera access dengan fallback
- ✅ Gallery picker dengan file validation
- ✅ Auto watermark dengan config
- ✅ Error messages yang user-friendly
- ✅ Mobile responsive

#### 3. **DetailPreview Component** (`src/components/DetailPreview.tsx`)
Preview modal untuk lihat detail lengkap berita acara:
- Tampilkan semua info (tanggal, pengirim, alamat, resi, foto)
- Foto preview + watermark info
- Action buttons (Edit, Finalize)
- Lock status indicator

**Features**:
- ✅ Grid layout untuk info organization
- ✅ Foto preview dengan zoom
- ✅ Resi list dengan numbering
- ✅ Lock status badge
- ✅ Edit & Finalize buttons

#### 4. **Updated DeliveryNoteModal** (`src/components/DeliveryNoteModal.tsx`)
Refactored modal dengan architecture terstruktur:
- Separate PhotoCapture component (reusable)
- Support create & edit modes
- Finalize button (lock dokumen)
- Clean validation logic
- Better error handling

**Modes**:
1. **Create Mode**: New berita acara (show form + resi selector + camera)
2. **Edit Mode**: Update existing (only show camera/gallery + finalize button)

#### 5. **Updated DeliveryNotes Page** (`src/pages/DeliveryNotes.tsx`)
Enhanced dengan:
- Preview detail modal
- Edit functionality
- Finalize support
- Better action buttons (Preview, Edit, Download, etc)
- Lock status badge untuk finalized docs

### Database Changes

**New Columns**:
- `is_finalized` (boolean): Lock status dokumen
- `photo_source` (text): Track sumber foto (camera/gallery)
- `updated_at` (timestamp): Update timestamp

**Policy Updates**:
- Edit policy sekarang check `NOT is_finalized` condition
- Prevent edit jika dokumen sudah finalized

**Migration Script**: `database_migration_v3.sql`

---

## User Flows

### 1. Create Berita Acara + Photo (Camera)
```
1. Click "Buat Baru" button
2. Fill: Tanggal, Pengirim, Alamat, Ekspedisi, Kurir
3. Select resi(s) dari list
4. Click "Kamera" → start camera
5. Click "JEPRET & WATERMARK" → capture photo with watermark
6. Click "SIMPAN BERKAS" → save to database
✅ Berita acara created with photo
```

### 2. Create Berita Acara + Photo (Gallery)
```
1. Click "Buat Baru" button
2. Fill: Tanggal, Pengirim, Alamat, Ekspedisi, Kurir
3. Select resi(s) dari list
4. Click "Galeri" → open file picker
5. Select image from device
6. File validated & watermarked automatically
7. Click "SIMPAN BERKAS" → save to database
✅ Berita acara created with gallery photo
```

### 3. Edit Photo (After Create)
```
1. In Berita Acara list, click "EDIT" button
2. Modal opens (edit mode) - form fields HIDDEN
3. Change camera/gallery photo as needed
4. Click "UPDATE FOTO" → save changes
✅ Photo updated successfully
```

### 4. Finalize/Lock Dokumen
```
1. In Berita Acara list, click "Preview" (Eye icon)
2. DetailPreview modal opens
3. Click "Finalisasi" button
4. Confirm dialog appears
5. After confirm → dokumen locked, can't edit anymore
6. Lock icon appears on table row
✅ Dokumen finalized (tidak bisa diedit)
```

### 5. View Details
```
1. Click "Preview" (Eye icon) on any row
2. DetailPreview modal shows:
   - All document info
   - Photo preview
   - Watermark details
   - Edit/Finalize buttons (if not locked)
3. Can click "Edit" to modify photo
✅ Full document visibility
```

---

## Technical Details

### Watermark Logic

**Applied to BOTH sources** (Camera & Gallery):
1. Load image (video frame or file)
2. Resize ke max 1280px (maintain aspect ratio)
3. Draw ke canvas
4. Add shadow effect
5. Add text info:
   - Tanggal/Jam
   - Penerima/Ekspedisi
   - Pengirim
   - Jumlah paket
   - Alamat (auto-wrap)
6. Export JPEG 75% quality (~150KB average)
7. Store base64 ke database

**File Size Management**:
- Input max: 5MB
- After watermark: ~150-300KB
- Database column: text (unlimited in Supabase)
- HTTP response: <10MB per document

### Error Handling

| Error | Handling | User Message |
|-------|----------|--------------|
| Camera denied | Fallback offered | "Izinkan akses kamera di pengaturan" |
| File too large | Validation | "File terlalu besar (X.XMB > 5MB)" |
| Invalid format | Validation | "Format file tidak didukung. Gunakan: JPG, PNG, WEBP" |
| Canvas error | Validation | "Gagal memproses foto" |
| Database error | Try-catch | "[error.message]" |

### Performance Considerations

**Optimizations**:
1. **Lazy loading**: PhotoService imported only when needed
2. **Image compression**: 75% JPEG quality (imperceptible quality loss)
3. **Canvas resize**: Limited to 1280px max
4. **Async operations**: FileReader & image processing non-blocking
5. **Memoization**: React components with proper deps arrays

**Browser Compatibility**:
- ✅ Chrome/Edge 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Code Quality

### Best Practices Implemented

✅ **Clean Code**:
- Single Responsibility Principle
- DRY (Don't Repeat Yourself)
- Meaningful variable names
- Proper comments

✅ **Type Safety**:
- Full TypeScript coverage
- No `any` types
- Proper interface definitions
- Type-safe event handlers

✅ **Error Handling**:
- Try-catch blocks
- User-friendly error messages
- Console logging for debugging
- Graceful fallbacks

✅ **Performance**:
- Optimized image processing
- Efficient state management
- No unnecessary re-renders
- Async/await for long operations

✅ **Maintainability**:
- Clear component separation
- Reusable components
- Well-documented functions
- Consistent code style

---

## Database Schema

```sql
-- Delivery Notes Table
CREATE TABLE public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  note_date date NOT NULL,
  sender_name text NOT NULL,
  sender_address text NOT NULL,
  expedition text NOT NULL,
  courier_name text,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_name text NOT NULL,
  photo_data text,                          -- Base64 photo
  is_finalized boolean DEFAULT false,       -- Lock status
  photo_source text DEFAULT 'camera',       -- 'camera' | 'gallery'
  updated_at timestamp with time zone DEFAULT now()  -- Last update time
);

-- Indexes
CREATE INDEX idx_delivery_notes_date ON public.delivery_notes (note_date);
CREATE INDEX idx_delivery_notes_created ON public.delivery_notes (created_at DESC);
CREATE INDEX idx_delivery_notes_finalized ON public.delivery_notes (is_finalized, created_at DESC);
```

---

## Testing Checklist

### Manual Testing (Completed ✅)

- [x] **Build**: `npm run build` - No TypeScript errors
- [x] **Dev Server**: `npm run dev` - Application starts
- [x] **Gallery Upload**: Select image → Watermark applied → Save works
- [x] **Camera Capture**: Camera starts → Capture works → Watermark applied
- [x] **Edit Mode**: Can edit existing → Can update photo
- [x] **Finalize**: Lock functionality works → Edit disabled after finalize
- [x] **Preview**: Detail preview shows all info correctly
- [x] **Error Handling**: Error messages displayed correctly
- [x] **Mobile**: Responsive on mobile devices
- [x] **Console**: No errors/warnings in DevTools

### Automated Tests (Optional)
- Component unit tests
- PhotoService utility tests
- Integration tests

---

## Migration Guide

### For Existing Data

1. **Run Migration Script**:
   ```bash
   # Execute in Supabase SQL Editor:
   source database_migration_v3.sql
   ```

2. **Default Values**:
   - `is_finalized`: false (all existing docs unlocked)
   - `photo_source`: 'camera' (assume camera for existing photos)
   - `updated_at`: now() (set to current time)

3. **No Data Loss**: All existing data preserved, new columns added with defaults

---

## Deployment

### Pre-deployment Checklist
- [x] Build successful: `npm run build`
- [x] No TypeScript errors
- [x] No console warnings/errors
- [x] Database schema prepared
- [x] Manual testing passed

### Deployment Steps
1. Run database migration on Supabase
2. Deploy code to Vercel (auto-deploy from Git)
3. Test on production: Create, Edit, Gallery, Finalize flows
4. Monitor for errors in PM2 logs

---

## Environment Variables

No new environment variables needed. Existing configuration:
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`

---

## Future Enhancements

- [ ] Image crop/rotate before watermark
- [ ] Batch upload multiple photos
- [ ] Photo gallery/carousel in detail preview
- [ ] OCR untuk auto-fill data dari receipt
- [ ] Cloud storage (S3/GCS) for cheaper storage
- [ ] Video capture support
- [ ] Digital signature

---

## Support & Troubleshooting

### Issue: Camera not working
- Check browser permissions (Settings → Privacy → Camera)
- Ensure HTTPS connection (required for camera access)
- Try different browser

### Issue: Gallery not showing
- Check file format (JPG, PNG, WEBP only)
- Check file size (<5MB)
- Try different device/OS

### Issue: Watermark text too small
- Automatically scales based on image resolution
- Minimum font size: 16px

### Issue: Can't edit after finalize
- Expected behavior! Click lock icon to understand
- Admin can unlock in database if needed

---

## Support

For issues or questions:
1. Check console for error messages (F12)
2. Review this documentation
3. Check database logs (Supabase dashboard)
4. Contact development team

---

**Last Updated**: 2026-06-29
**Version**: v3.0
**Status**: ✅ Production Ready
