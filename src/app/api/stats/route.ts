import { NextResponse } from 'next/server';
import { getTodayScans, getConfig } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
    const scans = getTodayScans();
    const sortedScans = [...scans].sort(
        (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
    );

    const lastScanned = sortedScans.length > 0 ? sortedScans[0] : null;
    const config = getConfig();

    return NextResponse.json({
        totalScannedToday: scans.length,
        target: config.dailyTarget,
        lastScanned: lastScanned,
        recentHistory: sortedScans.slice(0, 5) // Ambil 5 riwayat terbaru
    });
}
