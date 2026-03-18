import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { tracking_number } = await req.json();

        if (!tracking_number || typeof tracking_number !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Nomor resi tidak valid' },
                { status: 400 }
            );
        }

        const rawResi = tracking_number.trim().toUpperCase();

        // Database Injection: Memasukkan ke PostgreSQL
        const { data, error } = await supabase
            .from('scan_resi')
            .insert([
                { tracking_number: rawResi, status: 'success' }
            ])
            .select()
            .single();

        if (error) {
            // Error Code 23505 = UNIQUE Constraint Violation (Barang sudah ada 100% Valid)
            if (error.code === '23505') {
                return NextResponse.json(
                    { success: false, error: 'Telah discan!', isDuplicate: true },
                    { status: 409 }
                );
            }
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            message: 'Resi berhasil ditambahkan',
            item: data
        });

    } catch (error: any) {
        console.error("Database error:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Terjadi kesalahan sistem Database.' },
            { status: 500 }
        );
    }
}
