import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { config } = await req.json();

        // Ambil waktu tengah malam hari ini (WIB / Waktu Lokal Eksekusi)
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Query 1: Menghitung secara Live jumlah Resi hari ini
        const { count, error: countError } = await supabase
            .from('scan_resi')
            .select('*', { count: 'exact', head: true })
            .gte('scanned_at', startOfDay);

        if (countError) throw countError;

        // Query 2: Mengambil 5 Riwayat terbaru dengan cepat
        const { data: recent, error: recentError } = await supabase
            .from('scan_resi')
            .select('tracking_number, status, scanned_at')
            .order('scanned_at', { ascending: false })
            .limit(6);

        if (recentError) throw recentError;

        return NextResponse.json({
            totalScannedToday: count || 0,
            target: config?.dailyTarget || 100,
            lastScanned: recent?.[0] || null,
            recentHistory: recent || []
        });

    } catch (e: any) {
        console.error("Gagal ambil stat Database Supabase:", e.message);
        return NextResponse.json({
            totalScannedToday: 0,
            target: 100,
            lastScanned: null,
            recentHistory: []
        });
    }
}
