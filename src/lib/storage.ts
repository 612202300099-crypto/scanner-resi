import fs from 'fs';
import path from 'path';
import os from 'os';

// Mendefinisikan struktur data
export interface ScannedItem {
  id: string;
  tracking_number: string;
  scanned_at: string;
  status: 'success' | 'duplicate';
}

export interface AppConfig {
  scriptWebUrl: string; // URL Webhook dari Google Apps Script
  sheetName: string;
  targetColumn: string;
  dailyTarget: number;
}

// Deteksi lingkungan Vercel (Serverless tidak bisa menulis ke disk root)
const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV;
// Gunakan direktori /tmp bawaan OS jika di Vercel, atau folder ./data lokal jika di komputer/VPS
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'scanner_data') : path.join(process.cwd(), 'data');
const SCANS_FILE = path.join(DATA_DIR, 'scans.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Memastikan direktori data tersedia
const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("Gagal membuat direktori data, mungkin masalah permission disk Vercel:", e);
    }
  }
};

const DEFAULT_CONFIG: AppConfig = {
  scriptWebUrl: '',
  sheetName: 'Sheet1',
  targetColumn: 'A',
  dailyTarget: 100,
};

export const getConfig = (): AppConfig => {
  ensureDataDir();

  // FIX VERCEL COLD START:
  // Di Vercel, /tmp akan di-reset setiap aplikasi tidak dipakai.
  // Kita harus membaca dari config.json orisinil (bawaan deploy) jika ada.
  const fallbackConfigPaths = [
    CONFIG_FILE,
    path.join(process.cwd(), 'data/config.json') // File bawaan saat deploy
  ];

  for (const p of fallbackConfigPaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      } catch (e) {
        console.error("Gagal membaca config", p, e);
      }
    }
  }

  // Jika tidak ada di mana pun
  return DEFAULT_CONFIG;
};

export const saveConfig = (config: Partial<AppConfig>) => {
  const currentConfig = getConfig();
  const newConfig = { ...currentConfig, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
  return newConfig;
};

export const getScans = (): ScannedItem[] => {
  ensureDataDir();
  if (fs.existsSync(SCANS_FILE)) {
    try {
      const data = fs.readFileSync(SCANS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
};

export const addScan = (item: ScannedItem) => {
  const scans = getScans();
  scans.push(item);
  fs.writeFileSync(SCANS_FILE, JSON.stringify(scans, null, 2), 'utf-8');
  return scans;
};

export const resetScans = () => {
  ensureDataDir();
  fs.writeFileSync(SCANS_FILE, JSON.stringify([], null, 2), 'utf-8');
};

// Mengambil hanya scan hari ini
export const getTodayScans = (): ScannedItem[] => {
  const scans = getScans();
  const today = new Date().toISOString().split('T')[0];
  return scans.filter(s => s.scanned_at.startsWith(today));
};

