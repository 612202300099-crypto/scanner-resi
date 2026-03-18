import { NextResponse } from 'next/server';
import { appendToSheet } from '@/lib/sheets';
import { AppConfig, getConfig } from '@/lib/storage';

export async function POST(req: Request) {
    try {
        const { config } = await req.json();

        // Fallback ke config lokal di server bila klien tidak kirim config (baru loading)
        const activeConfig: AppConfig = config?.scriptWebUrl ? config : getConfig();

        if (!activeConfig || !activeConfig.scriptWebUrl) {
            return NextResponse.json({ totalScannedToday: 0, target: 100, lastScanned: null, recentHistory: [] });
        }

        // Tanya langsung ke Master Data (Google Sheet)
        const sheetResponse = await appendToSheet({
            action: 'GET_STATS'
        }, activeConfig);

        return NextResponse.json({
            totalScannedToday: sheetResponse.total || 0,
            target: activeConfig.dailyTarget || 100,
            lastScanned: sheetResponse.recentHistory?.[0] || null,
            recentHistory: sheetResponse.recentHistory || []
        });

    } catch (e: any) {
        console.error("Gagal ambil stat dari Sheet:", e.message);
        return NextResponse.json({
            totalScannedToday: 0,
            target: 100,
            lastScanned: null,
            recentHistory: []
        });
    }
}
