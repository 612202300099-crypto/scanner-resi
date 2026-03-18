import { NextResponse } from 'next/server';
import { resetScans } from '@/lib/storage';

export async function DELETE() {
    resetScans();
    return NextResponse.json({ success: true, message: 'Data resi hari ini telah di-reset.' });
}
