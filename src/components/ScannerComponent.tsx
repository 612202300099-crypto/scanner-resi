'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
    onScan: (decodedText: string) => void;
}

export default function ScannerComponent({ onScan }: ScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        let isComponentUnmounted = false;

        const initScanner = async () => {
            try {
                // Memastikan tidak double-render
                if (scannerRef.current) return;

                scannerRef.current = new Html5Qrcode("reader");

                const config = {
                    fps: 10,
                    // Area scan diperbesar tingginya agar barcode lebih mudah tertangkap
                    qrbox: { width: 320, height: 280 },
                    aspectRatio: 1.0,
                };

                // Memulai kamera belakang (environment) secara paksa
                await scannerRef.current.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        // Teruskan ke parent component
                        onScan(decodedText);
                    },
                    (errorMessage) => {
                        // Abaikan error per frame
                    }
                );
            } catch (err) {
                console.error("Kamera gagal dimulai:", err);
            }
        };

        const timer = setTimeout(initScanner, 300);

        return () => {
            isComponentUnmounted = true;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    if (scannerRef.current) {
                        scannerRef.current.clear();
                        scannerRef.current = null;
                    }
                }).catch(console.error);
            }
        };
    }, []); // onScan sengaja dihilangkan dari dependency array agar kamera tidak re-render saat state parent berubah

    return (
        <div className="scanner-container">
            <div id="reader" style={{ width: '100%', height: '100%', border: 'none' }}></div>
            <div className="scanner-overlay"></div>
        </div>
    );
}
