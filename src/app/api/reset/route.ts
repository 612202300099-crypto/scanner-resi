import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE() {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const { error } = await supabase
            .from('scan_resi')
            .delete()
            .gte('scanned_at', startOfDay);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Riwayat hari ini berhasil dihapus dari Database' });
    } catch (error: any) {
        console.error("Gagal mereset database harian:", error.message);
        return NextResponse.json(
            { success: false, error: 'Terjadi kesalahan sistem Reset Database.' },
            { status: 500 }
        );
    }
}
