import { NextResponse } from 'next/server';
import { appendToSheet } from '@/lib/sheets';
import { getConfig } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const config = getConfig();

        // Tanya langsung ke Master Data (Google Sheet)
        const sheetResponse = await appendToSheet({
            action: 'GET_STATS'
        });

        return NextResponse.json({
            totalScannedToday: sheetResponse.total || 0,
            target: config.dailyTarget,
            lastScanned: sheetResponse.recentHistory?.[0] || null,
            recentHistory: sheetResponse.recentHistory || []
        });

    } catch (e: any) {
        console.error("Gagal ambil stat dari Sheet:", e.message);
        // Fallback damai jika gagal connect (misal awal install belum pasang App Script)
        return NextResponse.json({
            totalScannedToday: 0,
            target: getConfig().dailyTarget,
            lastScanned: null,
            recentHistory: []
        });
    }
}
