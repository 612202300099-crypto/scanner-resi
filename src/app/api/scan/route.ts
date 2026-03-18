import { NextResponse } from 'next/server';
import { appendToSheet } from '@/lib/sheets';

export async function POST(req: Request) {
    try {
        const { tracking_number, config } = await req.json();

        if (!tracking_number || typeof tracking_number !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Nomor resi tidak valid' },
                { status: 400 }
            );
        }

        if (!config || !config.scriptWebUrl) {
            return NextResponse.json(
                { success: false, error: 'Belum ada URL Apps Script di pengaturan Browser Anda!' },
                { status: 400 }
            );
        }

        // Seluruh cek duplikat & penyimpanan data sekarang DIAMBIL ALIH OLEH GOOGLE SHEET
        const sheetResponse = await appendToSheet({
            action: 'SCAN',
            tracking_number: tracking_number
        }, config);

        // App Script mendeteksi bahwa resi tersebut sudah tertulis di Excel
        if (sheetResponse.is_duplicate) {
            return NextResponse.json(
                { success: false, error: 'Telah discan!', isDuplicate: true },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Resi berhasil ditambahkan',
            item: { tracking_number, status: 'success', scanned_at: sheetResponse.scanned_at || new Date().toISOString() }
        });

    } catch (error: any) {
        console.error("Scan error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Terjadi kesalahan sistem HTTPS.' },
            { status: 500 }
        );
    }
}
