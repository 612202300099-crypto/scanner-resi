#!/bin/bash
# Testing Checklist - Gallery Picker & Finalize Feature
# Run this on browser DevTools (F12 -> Console)

cat << 'EOF'

====================================================================
🧪 TESTING CHECKLIST - Gallery Picker & Finalize Feature
====================================================================

DEV SERVER: http://localhost:5173/
TEST DATE: 2026-06-29
BUILD STATUS: ✅ SUCCESS (0 errors)

====================================================================
PHASE 1: BUILD & COMPILATION
====================================================================

[✅] TypeScript compilation: npm run build
     Result: SUCCESS - No type errors
     Output: dist/ created with 6 asset files
     Bundle size: 1.594MB (minified), 490.60KB (gzip)

[✅] Dev server startup: npm run dev
     Result: SUCCESS - Vite v8.0.2 ready
     Local: http://localhost:5173/
     Status: Running

====================================================================
PHASE 2: COMPONENT TESTING (DevTools Required)
====================================================================

TEST 1: Check PhotoCapture Component Rendering
---------
Steps:
  1. Navigate to "Arsip Berita Acara" page
  2. Click "Buat Baru" button
  3. Modal opens with 3 columns

Expected:
  ✓ Column 1: Form fields (Tanggal, Pengirim, Alamat, Ekspedisi, Kurir)
  ✓ Column 2: Photo capture area with [Kamera] [Galeri] buttons
  ✓ Column 3: Resi selector with search

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 2: Camera Functionality
---------
Steps:
  1. Click [Kamera] button in photo area
  2. Grant camera access if prompted
  3. Live video feed appears
  4. Click "JEPRET & WATERMARK"
  5. Photo captured with watermark overlay

Expected:
  ✓ Camera starts successfully
  ✓ Video feed visible (or fallback message if denied)
  ✓ "JEPRET & WATERMARK" button present
  ✓ Photo captured with text watermark:
    - Date/time in yellow
    - Sender, expedition, courier info
    - Address auto-wrapped
    - Shadow effect on text
  ✓ Photo preview shows after capture

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 3: Gallery Picker Functionality
---------
Steps:
  1. Click [Galeri] button in photo area
  2. File picker opens
  3. Select JPG/PNG/WEBP image
  4. File auto-validated
  5. Watermark applied
  6. Photo preview shows

Expected:
  ✓ File picker supports .jpg, .png, .webp
  ✓ File size limit checked (<5MB)
  ✓ Error for unsupported format
  ✓ Watermark auto-applied (same as camera)
  ✓ File info displayed: "filename.jpg • XKB"
  ✓ Preview shows watermarked image

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 4: File Validation
---------
Steps:
  1. Try upload file > 5MB
  2. Try upload .doc, .txt, .gif file
  3. Try upload valid JPG/PNG
  4. Check console (F12) for messages

Expected:
  ✓ File > 5MB: Error message "File terlalu besar..."
  ✓ Invalid format: Error message "Format file tidak didukung..."
  ✓ Valid file: Processed successfully, no console errors
  ✓ Console: No warnings/errors (clean)

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 5: Create Berita Acara (Full Flow)
---------
Steps:
  1. Click "Buat Baru"
  2. Fill: Tanggal, Pengirim, Alamat, Ekspedisi, Kurir
  3. Select scan date
  4. Select 2-3 resi from list
  5. Take photo (camera OR gallery)
  6. Click "SIMPAN BERKAS"

Expected:
  ✓ Form fields accept input
  ✓ Resi checkboxes work ("X Resi" counter updates)
  ✓ Photo captured/selected
  ✓ Save button enabled
  ✓ Modal closes after save
  ✓ New entry appears in table

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 6: Edit Functionality
---------
Steps:
  1. In Berita Acara list, find row with photo
  2. Click "EDIT" button
  3. Modal opens in EDIT mode:
     - Form fields HIDDEN (no tanggal/pengirim/etc)
     - Only photo capture area visible
     - "UPDATE FOTO" button visible
  4. Select different photo (gallery)
  5. Click "UPDATE FOTO"
  6. Modal closes, table refreshes

Expected:
  ✓ Edit mode: Form hidden, photo only
  ✓ Can take new camera photo OR select gallery
  ✓ Photo updates in database
  ✓ List refreshes automatically
  ✓ No console errors

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 7: Preview Detail Modal
---------
Steps:
  1. In Berita Acara list, click Eye icon (👁️)
  2. DetailPreview modal opens
  3. Check all sections:
     - Header with title
     - Status badges (photo status, lock status if any)
     - Info grid (tanggal, pengirim, ekspedisi, kurir)
     - Alamat section
     - Daftar Resi list
     - Foto preview
     - Photo source info ("Kamera" or "Galeri")

Expected:
  ✓ All sections visible
  ✓ Photo displays correctly
  ✓ Resi list shows all selected items
  ✓ Lock status badge appears if finalized
  ✓ Edit & Finalize buttons visible (if not locked)

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 8: Finalize/Lock Functionality
---------
Steps:
  1. Open DetailPreview (click Eye icon)
  2. Click "🔒 FINALISASI" button
  3. Confirm dialog appears
  4. Click confirm
  5. Check table row again

Expected:
  ✓ Finalize button triggers confirm dialog
  ✓ After confirm: Document locked
  ✓ Table shows "LOCKED" badge
  ✓ Edit button disappears from table row
  ✓ Preview shows "Dokumen tidak bisa diedit" & lock icon
  ✓ No console errors

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 9: Prevent Edit When Finalized
---------
Steps:
  1. Select a finalized document
  2. Check if "EDIT" button is missing
  3. Try to click row (if any edit options)
  4. Verify no edit operations allowed

Expected:
  ✓ EDIT button NOT visible for locked docs
  ✓ Delete button NOT visible for locked docs (if admin)
  ✓ Preview shows "TERKUNCI" badge
  ✓ No way to modify locked document

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 10: Console Errors Check
---------
Steps:
  1. Open DevTools (F12)
  2. Go to Console tab
  3. Perform all above tests
  4. Check for any red errors or warnings

Expected:
  ✓ NO red error messages
  ✓ NO uncaught exceptions
  ✓ Only info/debug messages allowed
  ✓ PhotoCapture component renders without errors
  ✓ DetailPreview opens without errors

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


====================================================================
PHASE 3: BROWSER COMPATIBILITY
====================================================================

BROWSERS TO TEST:
- [ ] Chrome/Edge 80+ (Desktop)
- [ ] Firefox 75+
- [ ] Safari (if available)
- [ ] Mobile Chrome
- [ ] Mobile Safari (iOS)

Note: Current testing on __________________


====================================================================
PHASE 4: MOBILE RESPONSIVENESS
====================================================================

TEST 11: Mobile Layout
---------
Steps:
  1. Open DevTools (F12)
  2. Toggle device toolbar (Ctrl+Shift+M)
  3. Select mobile device (iPhone 12)
  4. Test all flows:
     - Create berita acara
     - Upload photo
     - Edit
     - Preview detail
     - Finalize

Expected:
  ✓ Modal stacks into 1 column on mobile
  ✓ All buttons accessible
  ✓ Form inputs work on mobile keyboard
  ✓ Photo capture/gallery works on mobile
  ✓ No horizontal scroll

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


====================================================================
PHASE 5: DATABASE & PERSISTENCE
====================================================================

TEST 12: Data Persistence
---------
Steps:
  1. Create berita acara with photo
  2. Refresh page (F5)
  3. Check if data still visible in list

Expected:
  ✓ Berita acara persisted in database
  ✓ Photo visible after page reload
  ✓ All fields preserved

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 13: Finalize Persistence
---------
Steps:
  1. Finalize a document
  2. Refresh page
  3. Check if still locked

Expected:
  ✓ is_finalized flag preserved
  ✓ Lock status persists after reload
  ✓ Edit still disabled

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


====================================================================
PHASE 6: ERROR SCENARIOS
====================================================================

TEST 14: Network Error Handling
---------
Steps:
  1. Open DevTools Network tab
  2. Throttle to "Offline"
  3. Try to create berita acara
  4. Try to save

Expected:
  ✓ Error message shown to user
  ✓ No silent failures
  ✓ Helpful error text

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


TEST 15: Camera Permission Denied
---------
Steps:
  1. Block camera in browser settings
  2. Click [Kamera] button
  3. Check error message

Expected:
  ✓ User-friendly error message
  ✓ Fallback option (use gallery)
  ✓ No crash

Result: [ ] PASS [ ] FAIL
Note: _______________________________________________________________


====================================================================
SUMMARY
====================================================================

TOTAL TESTS: 15
PASSED: _____ / 15
FAILED: _____ / 15

CRITICAL FAILURES (must fix):
1. ___________________________________________________________________
2. ___________________________________________________________________
3. ___________________________________________________________________

MINOR ISSUES (nice to have):
1. ___________________________________________________________________
2. ___________________________________________________________________

STATUS: [ ] READY TO DEPLOY  [ ] NEEDS FIXES

====================================================================

APPROVAL SIGNATURE:
Tester: ________________________     Date: __________
Reviewed By: ____________________     Date: __________

EOF
