import { getConfig } from './storage';

export const appendToSheet = async (payload: any) => {
    const config = getConfig();

    let url = config.scriptWebUrl?.trim() || '';

    if (!url) {
        throw new Error("URL Webhook Google Apps Script belum diisi di Pengaturan.");
    }

    // 1. VALIDASI SUPER KETAT URL WEBHOOK APPS SCRIPT
    if (!url.startsWith('https://script.google.com/macros/s/')) {
        throw new Error(
            "URL SALAH! Anda sepertinya me-copy link dari atas browser (Editor Script).\n" +
            "Yang Benar: Di pojok kanan atas layar Apps Script, klik tombol biru 'Deploy' (Terapkan) -> Pilih 'Manage Deployments' -> Copy 'Web app URL' -> Paste ke sini.\n" +
            "(Contoh URL yang benar harus ada tulisan /macros/s/ di tengahnya)"
        );
    }

    // 2. AUTO-FIX URL
    if (url.includes('/edit')) {
        url = url.split('/edit')[0] + '/exec';
    } else if (!url.endsWith('/exec')) {
        url = url.split('?')[0];
        if (!url.endsWith('/exec')) {
            if (url.endsWith('/')) {
                url += 'exec';
            } else {
                url += '/exec'; // Paksa tambah exec
            }
        }
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({
                ...payload,
                sheetName: config.sheetName,
                targetColumn: config.targetColumn,
            }),
            redirect: 'follow', // Penting agar AppScript mengembalikan redirect URL final HTTP 200
        });

        const dataText = await response.text();

        // 2. DETEKSI CEGATAN LOGIN GOOGLE (Mendeteksi HTML DOCTYPE)
        if (dataText.toLowerCase().includes('<!doctype html>') || dataText.toLowerCase().includes('<html')) {
            throw new Error(
                "Ditolak! (Google meminta Login).\nIni terjadi apabila Izin Akses salah.\nBuka kembali Apps Script. Klik 'Manage Deployments' (Penerapan) -> Edit (ikon pensil).\n1. Pastikan 'Execute as' adalah 'Me' (Bukan User accessing).\n2. Pastikan 'Who has access' adalah 'Anyone'."
            );
        }

        let data;
        try {
            data = JSON.parse(dataText);
        } catch {
            throw new Error(`Respon aneh (Bukan JSON) dari Google: ${dataText.substring(0, 50)}...`);
        }

        if (!data.success && !data.is_duplicate) {
            throw new Error(data.error || "Gagal memasukkan data operasional gudang.");
        }

        return data;
    } catch (error: any) {
        console.error("Gagal mengirim data ke Webhook Google Apps Script:", error);
        throw new Error(error.message || "Gagal menghubungi Server Google.");
    }
};
