import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Scanner Resi Gudang',
  description: 'Sistem Pemindaian Resi Barcode Cepat untuk Gudang',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <div className="container">
          <header className="header">
            <div>
              <h1>📦 Scanner Resi</h1>
            </div>
            <nav>
              <Link href="/">Scan</Link>
              <Link href="/settings">Pengaturan</Link>
            </nav>
          </header>
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
