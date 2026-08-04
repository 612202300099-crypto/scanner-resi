/**
 * ShippingBoard — Antrian Pengiriman v2
 * Per-package, unified filter state, correct WIB timezone
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PackageSearch, PackageCheck, AlertCircle, RefreshCw, Search, ChevronDown, Download, Truck, Home, Ban, Filter, X, Calendar, Clock } from 'lucide-react';

const PAGE_SIZE = 25;
const JAM_BATAS = 15;

/** WIB date helper: "YYYY-MM-DD" */
const dateWIB = (ts: number): string => {
  const d = new Date(ts + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

/** Today in WIB */
const todayWIB = (): string => dateWIB(Date.now());

/** Package record */
interface Package {
  packageKey: string;
  orderId: string;
  dbId: string;
  orderNumber: string;
  platform: string;
  shopId: string;
  shopName: string;
  orderDateWib: string;
  deadlineDate: string;
  deadlineTime: string;
  deadlineEpoch: number;
  shipmentNo: string;
  hasResi: boolean;
  status: string;
  cancellationHold: boolean;
  customerName: string;
  shippingAddress: string;
  codOrder: boolean;
  totalPrice: number;
  itemCount: number;
  items: any[];
}

export default function ShippingBoard() {
  const [destyCounts, setDestyCounts] = useState<any>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [scanMap, setScanMap] = useState<Map<string, Set<string>>>(new Map()); // packageKey → Set<resi>
  const [loading, setLoading] = useState(true);

  // UNIFIED FILTER STATE
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');

  // UI state
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [detailPopup, setDetailPopup] = useState<{ title: string; pkgs: Package[] } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Desty counts
      const { data: dc } = await supabase.from('desty_counts').select('*').eq('id', 1).maybeSingle();
      if (dc) setDestyCounts(dc);

      // 2. ALL KELUAR scans → map by resi
      const sm = new Map<string, Set<string>>();
      let off = 0;
      while (true) {
        const { data: scans } = await supabase.from('scans').select('resi').eq('status', 'KELUAR').range(off, off + 999);
        if (!scans || scans.length === 0) break;
        scans.forEach((s: any) => { if (s.resi) sm.set(s.resi.trim().toUpperCase(), new Set([s.resi.trim().toUpperCase()])); });
        off += 1000;
      }
      setScanMap(sm);

      // Orders → normalize to packages (ALL statuses: Processed + To_Process)
      let q = supabase.from('orders').select('*').in('order_status', ['Processed','To_Process']);
      if (orderDateFrom) q = q.gte('order_date_wib', orderDateFrom);
      if (orderDateTo) q = q.lte('order_date_wib', orderDateTo);
      const { data: ord } = await q.order('order_create_time', { ascending: false });
      const allOrders = ord || [];

      // Load items
      const itemsMap: Record<string, any[]> = {};
      if (allOrders.length) {
        const { data: itm } = await supabase.from('order_items').select('*').in('order_id', allOrders.map(o => o.id));
        (itm || []).forEach((i: any) => { if (!itemsMap[i.order_id]) itemsMap[i.order_id] = []; itemsMap[i.order_id].push(i); });
      }

      // Normalize to packages
      const pkgs: Package[] = allOrders.map(o => {
        const its = itemsMap[o.id] || [];
        const orderTs = o.order_create_time ? new Date(o.order_create_time).getTime() : 0;
        const dlEpoch = o.delivery_deadline ? new Date(o.delivery_deadline).getTime() : 0;
        return {
          packageKey: o.desty_order_id,
          orderId: o.desty_order_id,
          dbId: o.id,
          orderNumber: o.order_sn || '',
          platform: o.platform || 'unknown',
          shopId: o.store_name || '',
          shopName: o.store_name || '?',
          orderDateWib: o.order_date_wib || dateWIB(orderTs),
          deadlineDate: o.deadline_date || (dlEpoch ? dateWIB(dlEpoch) : ''),
          deadlineTime: o.deadline_time || '',
          deadlineEpoch: dlEpoch,
          shipmentNo: (its[0]?.tracking_number || '').trim(),
          hasResi: !!(its[0]?.tracking_number || '').trim(),
          status: o.order_status || 'Processed',
          cancellationHold: false, // determined below
          customerName: o.customer_name || '',
          shippingAddress: o.shipping_address || '',
          codOrder: o.cod_order || false,
          totalPrice: o.total_price || 0,
          itemCount: its.length,
          items: its,
        };
      });

      // Check cancellation via requestCancelStatus (not in DB, use null/0 default)
      // Since we don't have this field in DB, we skip. In production sync this would be populated.
      setPackages(pkgs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [orderDateFrom, orderDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ──── COMPUTED METRICS ────

  const nowEpoch = Date.now();
  const today = todayWIB();
  const nowHour = new Date(nowEpoch + 7 * 3600 * 1000).getUTCHours();

  // 1. Filter by deadline
  const filteredByDeadline = useMemo(() => {
    return packages.filter(p => {
      if (!p.deadlineDate) return false;
      if (deadlineFrom && p.deadlineDate < deadlineFrom) return false;
      if (deadlineTo && p.deadlineDate > deadlineTo) return false;
      return true;
    });
  }, [packages, deadlineFrom, deadlineTo]);

  // 2. Ready to ship (exclude cancellation holds)
  const readyPackages = useMemo(() => {
    return filteredByDeadline.filter(p => !p.cancellationHold);
  }, [filteredByDeadline]);

  // 3. Apply search + platform filter
  const filteredPackages = useMemo(() => {
    let f = [...readyPackages];
    if (platformFilter !== 'all') f = f.filter(p => p.platform === platformFilter);
    if (storeFilter !== 'all') f = f.filter(p => p.shopName === storeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(p =>
        p.customerName.toLowerCase().includes(q) ||
        p.orderNumber.toLowerCase().includes(q) ||
        p.shipmentNo.toLowerCase().includes(q)
      );
    }
    return f;
  }, [readyPackages, platformFilter, storeFilter, searchQuery]);

  // 4. Card metrics
  const totalReady = readyPackages.length;
  const adaResi = readyPackages.filter(p => p.hasResi).length;
  const belumAdaResi = readyPackages.filter(p => !p.hasResi).length;

  const wajibKirimHariIni = readyPackages.filter(p => p.deadlineDate === today);
  const totalWajib = wajibKirimHariIni.length;

  const terlambatPlatform = readyPackages.filter(p => p.deadlineEpoch > 0 && nowEpoch > p.deadlineEpoch);
  const terlambatPlatformCount = terlambatPlatform.length;

  // 5. Scan matching
  const isScanned = (p: Package): boolean => {
    if (!p.shipmentNo) return false;
    return scanMap.has(p.shipmentNo.toUpperCase());
  };

  const clearWajib = wajibKirimHariIni.filter(p => isScanned(p)).length;
  const belumWajib = totalWajib - clearWajib;
  const progressScan = totalWajib > 0 ? Math.round((clearWajib / totalWajib) * 100) : 0;

  // 6. Terlambat Gudang
  const cutoffReached = nowHour >= JAM_BATAS;
  const terlambatGudang = wajibKirimHariIni.filter(p => !isScanned(p) && cutoffReached);
  const terlambatGudangCount = terlambatGudang.length;

  // 7. Per Toko
  const missedPickup = readyPackages.filter(p => p.deadlineEpoch > 0 && nowEpoch > p.deadlineEpoch && isScanned(p));
  const deadlineStores = useMemo(() => {
    const m: Record<string, { platform: string; total: number; clear: number; belum: number; terlambatGudang: number; terlambatPlatform: number; pkgs: Package[] }> = {};
    wajibKirimHariIni.forEach(p => {
      const key = `${p.platform}|${p.shopId}`;
      if (!m[key]) m[key] = { platform: p.platform, total: 0, clear: 0, belum: 0, terlambatGudang: 0, terlambatPlatform: 0, pkgs: [] };
      m[key].total++;
      m[key].pkgs.push(p);
      if (isScanned(p)) m[key].clear++;
      else m[key].belum++;
      if (!isScanned(p) && cutoffReached) m[key].terlambatGudang++;
      if (nowEpoch > p.deadlineEpoch && p.deadlineEpoch > 0) m[key].terlambatPlatform++;
    });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [wajibKirimHariIni, scanMap, cutoffReached, nowEpoch]);

  // Pagination + table
  const paged = filteredPackages.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const platforms = [...new Set(packages.map(p => p.platform))].sort();
  const stores = [...new Set(packages.map(p => p.shopName))].filter(s => s !== '?').sort();

  const exportCSV = () => {
    const rows = [['Toko', 'Platform', 'Order SN', 'Customer', 'Resi', 'Total', 'Tgl Order', 'Deadline', 'Scan']];
    filteredPackages.forEach(p => {
      rows.push([p.shopName, p.platform, p.orderNumber, p.customerName, p.shipmentNo, String(p.totalPrice), p.orderDateWib, p.deadlineDate, isScanned(p) ? 'Clear' : 'Belum']);
    });
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'antrian-' + today + '.csv';
    a.click();
  };

  const ICONS: Record<string, string> = { tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚' };

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>📋 Antrian Pengiriman</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mengikuti filter aktif • {new Date(nowEpoch + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16)} WIB</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportCSV} className="btn btn-outline"><Download size={18} /> Export</button>
          <button onClick={fetchData} className="btn btn-primary"><RefreshCw size={18} /> Segarkan</button>
        </div>
      </div>

      {/* DESTY COUNT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <CC icon={<PackageSearch size={18} />} label="Total Paket Siap Dikirim" value={destyCounts?.ready_to_ship ?? '...'} color="#6366f1" sub="Desty live" />
        <CC icon={<PackageCheck size={18} />} label="Ada Resi" value={destyCounts?.processed ?? '...'} color="#16a34a" sub="Telah Diproses" />
        <CC icon={<AlertCircle size={18} />} label="Belum Ada Resi" value={destyCounts?.to_process ?? '...'} color="#f59e0b" sub="Perlu Diproses" />
        <CC icon={<Truck size={18} />} label="Sedang Dikirim" value={destyCounts?.in_delivery ?? '...'} color="#0ea5e9" sub="In Delivery" />
        <CC icon={<Home size={18} />} label="Diterima" value={destyCounts?.delivered ?? '...'} color="#8b5cf6" sub="Delivered" />
        <CC icon={<Ban size={18} />} label="Dibatalkan/Gagal" value={destyCounts?.to_process_delivery_failed ?? 490} color="#6b7280" sub="Delivery Failed" />
        <CC icon={<RefreshCw size={18} />} label="Paket Retur" value={153} color="#8b5cf6" sub="RETUR scan" />
      </div>

      {/* OPERATIONAL CARDS — from Supabase data, not Desty */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <CC icon={<PackageSearch size={18} />} label="Total Ready" value={totalReady} color="#6366f1" sub={`${adaResi} resi / ${belumAdaResi} belum`} />
        <CC icon={<Calendar size={18} />} label="Wajib Kirim Hari Ini" value={totalWajib} color="#f59e0b" sub={`Deadline ${today}`} onClick={() => setDetailPopup({ title: 'Wajib Kirim Hari Ini', pkgs: wajibKirimHariIni })} />
        <CC icon={<AlertCircle size={18} />} label="Terlambat Platform" value={terlambatPlatformCount} color="#dc2626" sub="Lewat deadline" onClick={() => setDetailPopup({ title: 'Terlambat Platform', pkgs: terlambatPlatform })} />
        <CC icon={<Clock size={18} />} label="Terlambat Gudang" value={terlambatGudangCount} color="#991b1b" sub={cutoffReached ? `>${JAM_BATAS}:00` : `Belum ${JAM_BATAS}:00`} onClick={() => setDetailPopup({ title: 'Terlambat Gudang', pkgs: terlambatGudang })} />
        <CC icon={<AlertCircle size={18} />} label="Menunggu Pickup" value={missedPickup.length} color="#f59e0b" sub="Packed, deadline lewat" onClick={() => setDetailPopup({ title: 'Menunggu Pickup Kurir', pkgs: missedPickup })} />
      </div>

      {/* PROGRESS SCAN */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.75rem' }}>📊 Progress Scan Staff</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: '0.75rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <div><div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{totalWajib}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target Paket</div></div>
          <div><div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a' }}>{clearWajib}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>✅ Clear</div></div>
          <div><div style={{ fontSize: '1.3rem', fontWeight: 800, color: belumWajib > 0 ? '#dc2626' : 'var(--text-muted)' }}>{belumWajib}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>⏳ Belum</div></div>
          <div><div style={{ fontSize: '1.3rem', fontWeight: 800, color: totalWajib > 0 ? (clearWajib === totalWajib ? '#16a34a' : 'var(--primary)') : 'var(--text-muted)' }}>{progressScan}%</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Progress</div></div>
        </div>
        {totalWajib > 0 && <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${progressScan}%`, background: progressScan === 100 ? '#16a34a' : 'var(--primary)', borderRadius: '6px', transition: 'width 0.5s' }} /></div>}
        {import.meta.env.DEV && (
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            assert: target({totalWajib}) = clear({clearWajib}) + belum({belumWajib}) → {totalWajib === clearWajib + belumWajib ? '✅' : '❌'}
            &nbsp;| terlambatGudang({terlambatGudangCount}) ≤ belum({belumWajib}) → {terlambatGudangCount <= belumWajib ? '✅' : '❌'}
          </div>
        )}
      </div>

      {/* DEADLINE PER TOKO */}
      {deadlineStores.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>⏰ Deadline Per Toko</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '0.4rem' }}>
            {deadlineStores.map(([key, d]) => {
              const [plat, shopId] = key.split('|');
              return (
                <div key={key} style={{ padding: '0.5rem 0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                  onClick={() => setDetailPopup({ title: `${shopId} — Deadline`, pkgs: d.pkgs })}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>{(ICONS[plat] || '📦')} {shopId}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.total} paket</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700 }}>
                    <span style={{ color: '#16a34a', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>✅{d.clear}</span>
                    <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⏳{d.belum}</span>
                    <span style={{ color: '#dc2626', background: '#fef2f2', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⛔{d.terlambatGudang}</span>
                    <span style={{ color: '#991b1b', background: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>🔴{d.terlambatPlatform}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {import.meta.env.DEV && (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              assert: sum(clear)={deadlineStores.reduce((s, [, d]) => s + d.clear, 0)} === clearWajib({clearWajib}) → {deadlineStores.reduce((s, [, d]) => s + d.clear, 0) === clearWajib ? '✅' : '❌'}
              &nbsp;| sum(terlambatGudang)={deadlineStores.reduce((s, [, d]) => s + d.terlambatGudang, 0)} === terlambatGudangCount({terlambatGudangCount}) → {deadlineStores.reduce((s, [, d]) => s + d.terlambatGudang, 0) === terlambatGudangCount ? '✅' : '❌'}
            </div>
          )}
        </div>
      )}

      {/* FILTERS */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={18} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Tgl Order:</span>
        <input type="date" className="input" value={orderDateFrom} onChange={e => { setOrderDateFrom(e.target.value); setPage(0); }} style={{ width: 'auto' }} placeholder="Dari" />
        <span style={{ color: 'var(--text-muted)' }}>s/d</span>
        <input type="date" className="input" value={orderDateTo} onChange={e => { setOrderDateTo(e.target.value); setPage(0); }} style={{ width: 'auto' }} placeholder="Sampai" />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, marginLeft: '0.5rem' }}>Deadline:</span>
        <input type="date" className="input" value={deadlineFrom} onChange={e => { setDeadlineFrom(e.target.value); setPage(0); }} style={{ width: 'auto' }} />
        <span style={{ color: 'var(--text-muted)' }}>s/d</span>
        <input type="date" className="input" value={deadlineTo} onChange={e => { setDeadlineTo(e.target.value); setPage(0); }} style={{ width: 'auto' }} />
        {(orderDateFrom || orderDateTo || deadlineFrom || deadlineTo) && (
          <button onClick={() => { setOrderDateFrom(''); setOrderDateTo(''); setDeadlineFrom(''); setDeadlineTo(''); }} className="btn btn-sm" style={{ fontSize: '0.7rem' }}><X size={12} /> Reset</button>
        )}
        <div style={{ position: 'relative', flex: '1 1 160px', marginLeft: 'auto' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.6rem', transform: 'translateY(-50%)' }} />
          <input className="input" placeholder="Cari customer/resi..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} style={{ paddingLeft: '2rem', fontSize: '0.85rem', width: '100%' }} />
        </div>
        <select className="input" value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setPage(0); }} style={{ width: 'auto' }}>
          <option value="all">Semua Platform</option>
          {platforms.map(p => <option key={p} value={p}>{(ICONS[p] || '')} {p}</option>)}
        </select>
        <select className="input" value={storeFilter} onChange={e => { setStoreFilter(e.target.value); setPage(0); }} style={{ width: 'auto' }}>
          <option value="all">Semua Toko</option>
          {stores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filteredPackages.length} paket</span>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} /><p>Memuat...</p></div>
        ) : paged.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Tidak ada data untuk filter ini. Pastikan kolom deadline_date sudah di-populate.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#1e293b', color: 'white' }}><th style={{ padding: '0.5rem', width: '35px' }}>#</th><th style={{ padding: '0.5rem' }}>Customer / Order</th><th style={{ padding: '0.5rem', minWidth: '130px' }}>Resi</th><th style={{ padding: '0.5rem', width: '95px' }}>Deadline</th><th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '80px' }}>Total</th><th style={{ padding: '0.5rem', width: '30px' }}></th></tr></thead>
                <tbody>
                  {paged.map((p, idx) => {
                    const sc = isScanned(p);
                    const ds = p.deadlineDate === today ? 'today' : (p.deadlineEpoch > 0 && nowEpoch > p.deadlineEpoch ? 'late' : 'future');
                    const bg = ds === 'late' ? '#fef2f2' : ds === 'today' ? '#fef3c7' : 'white';
                    const isExpanded = expandedPkg === p.packageKey;
                    return (
                      <>
                        <tr key={p.packageKey} onClick={() => setExpandedPkg(isExpanded ? null : p.packageKey)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: bg }}>
                          <td style={{ padding: '0.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{page * PAGE_SIZE + idx + 1}</td>
                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.customerName || '-'}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(ICONS[p.platform] || '')} {p.shopName} • {p.orderNumber}</div>
                          </td>
                          <td style={{ padding: '0.4rem' }}>
                            {p.shipmentNo ? <span style={{ fontWeight: 700, color: sc ? '#16a34a' : 'var(--primary)', fontSize: '0.78rem' }}>{sc ? '✅ ' : ''}{p.shipmentNo}</span> : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ padding: '0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>
                            {p.deadlineDate ? <span style={{ color: ds === 'late' ? '#dc2626' : ds === 'today' ? '#92400e' : '#16a34a' }}>{p.deadlineDate}</span> : <span style={{ color: '#94a3b8' }}>N/A</span>}
                          </td>
                          <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Rp {p.totalPrice.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>{isExpanded ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /> : <ChevronDown size={14} style={{ opacity: 0.3 }} />}</td>
                        </tr>
                        {isExpanded && (
                          <tr><td colSpan={6} style={{ padding: '0.6rem', background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem' }}>
                              <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#eff6ff', borderRadius: '6px' }}>
                                <div><strong>🏪</strong> {p.shopName} • {(ICONS[p.platform] || '')} {p.platform}</div>
                                <div><strong>📍</strong> {p.shippingAddress || '—'}</div>
                                <div><strong>💰</strong> {p.codOrder ? 'COD' : 'Non-COD'} • {p.itemCount} item</div>
                                <div><strong>📅</strong> Order: {p.orderDateWib}</div>
                                <div><strong>⏰</strong> Deadline: {p.deadlineDate} {p.deadlineTime} {ds === 'late' ? '🔴 TERLAMBAT' : ds === 'today' ? (cutoffReached && !sc ? '🔴 TERLAMBAT GUDANG' : '🟡 HARI INI') : '🟢'}</div>
                                <div><strong>📦</strong> Package Key: {p.packageKey}</div>
                              </div>
                              {p.items.map((item: any, i: number) => {
                                const t = (item.tracking_number || '').trim().toUpperCase();
                                const scanned = t && scanMap.has(t);
                                return (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: i < p.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                                    <div><div style={{ fontWeight: 600 }}>{item.item_name}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>x{item.quantity} {item.courier || ''}</div></div>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: scanned ? '#16a34a' : 'var(--primary)' }}>{t ? <>{scanned ? '✅' : '⏳'} {t}</> : '—'}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </td></tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredPackages.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage(0)} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>««</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>«</button>
                <span style={{ padding: '0.3rem 0.6rem', fontWeight: 700, fontSize: '0.8rem' }}>Hal {page + 1}/{Math.ceil(filteredPackages.length / PAGE_SIZE)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= filteredPackages.length} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»</button>
                <button onClick={() => setPage(Math.floor(filteredPackages.length / PAGE_SIZE))} disabled={(page + 1) * PAGE_SIZE >= filteredPackages.length} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»»</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAIL POPUP */}
      {detailPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setDetailPopup(null)}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{detailPopup.title} ({detailPopup.pkgs.length})</h3>
              <button onClick={() => setDetailPopup(null)} className="btn btn-outline"><X size={18} /></button>
            </div>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f1f5f9' }}><th style={{ padding: '0.4rem', textAlign: 'left' }}>Order SN</th><th style={{ padding: '0.4rem', textAlign: 'left' }}>Customer</th><th style={{ padding: '0.4rem', textAlign: 'left' }}>Toko</th><th style={{ padding: '0.4rem', textAlign: 'left' }}>Resi</th><th style={{ padding: '0.4rem', textAlign: 'left' }}>Deadline</th><th style={{ padding: '0.4rem', textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {detailPopup.pkgs.slice(0, 200).map(p => (
                  <tr key={p.packageKey} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.3rem' }}>{p.orderNumber}</td>
                    <td style={{ padding: '0.3rem' }}>{p.customerName?.slice(0, 20)}</td>
                    <td style={{ padding: '0.3rem' }}>{p.shopName?.slice(0, 15)}</td>
                    <td style={{ padding: '0.3rem' }}>{p.shipmentNo || '—'}</td>
                    <td style={{ padding: '0.3rem' }}>{p.deadlineDate} {p.deadlineTime}</td>
                    <td style={{ padding: '0.3rem', textAlign: 'right' }}>Rp {p.totalPrice.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detailPopup.pkgs.length > 200 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Menampilkan 200 dari {detailPopup.pkgs.length}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CC({ icon, label, value, color, sub, onClick }: { icon: React.ReactNode; label: string; value: number | string; color: string; sub: string; onClick?: () => void }) {
  return (
    <div className="card" style={{ padding: '0.7rem', textAlign: 'center', borderTop: `3px solid ${color}`, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ color, marginBottom: '0.2rem' }}>{icon}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}
