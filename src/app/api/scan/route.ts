import { NextResponse } from 'next/server';
import { addScan, getTodayScans, ScannedItem } from '@/lib/storage';
import { appendToSheet } from '@/lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    try {
        const { tracking_number } = await req.json();

        if (!tracking_number || typeof tracking_number !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Nomor resi tidak valid' },
                { status: 400 }
            );
        }

        // Cek duplikat untuk hari ini
        const todayScans = getTodayScans();
        const isDuplicate = todayScans.some(
            (scan) => scan.tracking_number === tracking_number
        );

        if (isDuplicate) {
            return NextResponse.json(
                { success: false, error: 'Resi sudah pernah discan hari ini', isDuplicate: true },
                { status: 409 }
            );
        }

        // Coba tambahkan ke Google Sheets
        try {
            await appendToSheet(tracking_number);
        } catch (sheetError: any) {
            console.error(sheetError);
            return NextResponse.json(
                { success: false, error: 'Gagal menghubungi Google Sheets: ' + sheetError.message },
                { status: 500 }
            );
        }

        // Jika sukses di Google Sheets, tambahkan ke storage lokal / memory
        const newItem: ScannedItem = {
            id: uuidv4(),
            tracking_number,
            scanned_at: new Date().toISOString(),
            status: 'success'
        };

        addScan(newItem);

        return NextResponse.json({ success: true, message: 'Resi berhasil ditambahkan', item: newItem });
    } catch (error: any) {
        console.error("Scan error:", error);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem.' },
            { status: 500 }
        );
    }
}
