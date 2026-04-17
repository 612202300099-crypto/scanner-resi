import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

interface DeliveryNoteData {
    note_date: string;
    sender_name: string;
    sender_address: string;
    expedition: string;
    courier_name?: string;
    items: string[];
}

export const generateDeliveryNotePDF = (data: DeliveryNoteData, action: 'print' | 'preview' | 'download' = 'preview'): Blob | void => {
    // Definisi ukuran A4
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    // const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // Font setting
    doc.setFont('helvetica');

    // 1. KOTAK HEADER
    doc.setLineWidth(0.5);
    doc.setDrawColor(30, 64, 175); // Border biru tua
    doc.rect(margin, margin, pageWidth - (margin * 2), 16);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175); // Teks biru tua
    doc.text('BERITA ACARA SERAH TERIMA BARANG', pageWidth / 2, margin + 11, { align: 'center' });

    // 2. TANGGAL
    const formattedDate = dayjs(data.note_date).format('dddd, DD MMMM YYYY');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    
    let currentY = margin + 30;
    doc.text(`Kami yang bertanda tangan di bawah ini, Pada hari ${formattedDate}`, margin, currentY);
    currentY += 10;

    // 3. PIHAK PERTAMA (PENGIRIM)
    doc.setFont('helvetica', 'bold');
    doc.text('Nama', margin, currentY);
    doc.text(':', margin + 30, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.sender_name, margin + 35, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Alamat', margin, currentY);
    doc.text(':', margin + 30, currentY);
    doc.setFont('helvetica', 'normal');
    const splitAddress = doc.splitTextToSize(data.sender_address, pageWidth - margin - 40 - margin);
    doc.text(splitAddress, margin + 35, currentY);
    currentY += (splitAddress.length * 5) + 5;

    doc.text('Selanjutnya disebut ', margin, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('PIHAK PERTAMA', margin + 32, currentY);
    currentY += 12;

    // 4. PIHAK KEDUA (EKSPEDISI / KURIR)
    const pihakKeduaName = data.courier_name ? `${data.expedition} (${data.courier_name})` : data.expedition;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Nama', margin, currentY);
    doc.text(':', margin + 30, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(pihakKeduaName, margin + 35, currentY);
    currentY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Ekspedisi', margin, currentY);
    doc.text(':', margin + 30, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.expedition, margin + 35, currentY);
    currentY += 10;

    doc.text('Selanjutnya disebut ', margin, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text('PIHAK KEDUA', margin + 32, currentY);
    currentY += 15;

    // 5. REDAKSI PENYERAHAN
    doc.setFont('helvetica', 'normal');
    const redaksi = `PIHAK PERTAMA menyerahkan barang kepada PIHAK KEDUA, dan PIHAK KEDUA menyatakan telah mendapat barang dari PIHAK PERTAMA berupa ${data.items.length} paket dengan daftar terlampir`;
    const splitRedaksi = doc.splitTextToSize(redaksi, pageWidth - (margin * 2));
    doc.text(splitRedaksi, margin, currentY);
    currentY += (splitRedaksi.length * 5) + 5;

    // 6. TABEL RESI HEMAT KERTAS (3 KOLOM KOMBINASI)
    const ITEMS_PER_ROW = 3;
    const tableHead = [['NO', 'RESI', 'NO', 'RESI', 'NO', 'RESI']];
    const tableBody: any[][] = [];

    // Chunking array (Memecah array 1D ke 2D dengan jumlah sel 3 pasang (No, Resi))
    let currentRow: any[] = [];
    data.items.forEach((resi, index) => {
        currentRow.push((index + 1).toString()); // Nomor
        currentRow.push(resi);                   // Resi

        if (currentRow.length === ITEMS_PER_ROW * 2) {
            tableBody.push([...currentRow]);
            currentRow = [];
        }
    });

    // Jika ada sisa sel kosong di baris terakhir, isi dengan blank string supaya tabel tidak cacat
    if (currentRow.length > 0) {
        while (currentRow.length < ITEMS_PER_ROW * 2) {
            currentRow.push(''); // No Kosong
            currentRow.push(''); // Resi Kosong
        }
        tableBody.push(currentRow);
    }

    autoTable(doc, {
        startY: currentY,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        bodyStyles: {
            fontSize: 9,
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // No 1
            1: { cellWidth: 'auto' },               // Resi 1
            2: { cellWidth: 10, halign: 'center' }, // No 2
            3: { cellWidth: 'auto' },               // Resi 2
            4: { cellWidth: 10, halign: 'center' }, // No 3
            5: { cellWidth: 'auto' },               // Resi 3
        },
        margin: { left: margin, right: margin }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 30;

    // 7. TANDA TANGAN (BISA TURUN KE PAGE 2 SECARA OTOMATIS JIKA MELEBIHI HALAMAN)
    let signY = finalY;
    if (signY > 260) {
        doc.addPage();
        signY = 30;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    
    // Tanda Tangan Pihak Kedua (Kiri)
    doc.text('Yang Menerima', margin + 20, signY, { align: 'center' });
    doc.text('PIHAK KEDUA', margin + 20, signY + 5, { align: 'center' });
    doc.text(`(${pihakKeduaName})`, margin + 20, signY + 35, { align: 'center' });

    // Tanda Tangan Pihak Pertama (Kanan)
    doc.text('Yang Menyerahkan', pageWidth - margin - 20, signY, { align: 'center' });
    doc.text('PIHAK PERTAMA', pageWidth - margin - 20, signY + 5, { align: 'center' });
    doc.text(`(${data.sender_name})`, pageWidth - margin - 20, signY + 35, { align: 'center' });

    // 8. TIPE OUTPUT (Preview / Download / Print)
    if (action === 'preview') {
        const pdfOutput = doc.output('blob');
        return pdfOutput;
    } else if (action === 'download') {
        doc.save(`Berita_Acara_Serah_Terima_${data.expedition}_${dayjs(data.note_date).format('DD_MMM_YYYY')}.pdf`);
    } else if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    }
};
