import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/storage';

export async function GET() {
    const config = getConfig();
    return NextResponse.json(config);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const updated = saveConfig(body);
        return NextResponse.json({ success: true, config: updated });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Gagal update konfigurasi' }, { status: 500 });
    }
}
