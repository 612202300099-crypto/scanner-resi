/**
 * ShippingBoard — Antrian Pengiriman
 * 
 * DATA FLOW:
 * - Count cards: Desty LIVE via proxy (/desty-api/...)
 * - Order list: Desty LIVE via proxy (paginated, 91 Processed orders)
 * - Scan cross-ref: Supabase scans table (KELUAR)
 * - Stats (clear/belum, per toko): dihitung dari LIVE order list + scans
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
  PackageSearch, Clock, CheckCircle2, AlertCircle,
  RefreshCw, Search, ChevronDown, ChevronUp,
  Truck, PackageCheck, Home, Hash, Download
} from 'lucide-react';

dayjs.locale('id');

const DESTY_API = import.meta.env.VITE_DESTY_API_URL || '/desty-api';
const PAGE_SIZE = 30;

// ============================================================
// TYPES
// ============================================================
interface DestyCounts {
  ready_to_ship: number; processed: number; to_process: number;
  in_delivery: number; delivered: number; shipping: number; unpaid: number;
}

interface DestyOrder {
  orderId: string; displayedOrderSn: string; status: string;
  platformName: string; externalShopName: string;
  totalPrice: number; paymentMethod: string;
  shipmentNo: string; courier: string;
  recipientInfo: { name: string; address: { fullAddress: string; city: string } };
  orderCreateTime: number;
  items: Array<{ productName: string; quantity: number }>;
}

interface StoreInfo {
  platform: string; total: number; clear: number; resis: string[];
}

interface PageStats {
  total: number; clear: number; belum: number;
  byStore: Record<string, StoreInfo>;
}

// ============================================================
// HELPERS
// ============================================================
const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚',
};

// ============================================================
// COMPONENT
// ============================================================
export default function ShippingBoard() {
  const [counts, setCounts] = useState<DestyCounts | null>(null);
  const [allOrders, setAllOrders] = useState<DestyOrder[]>([]);
  const [scannedResis, setScannedResis] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price' | 'customer' | 'store'>('newest');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // ── FETCH ALL ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Counts from Desty (fallback: Supabase count)
      try {
        const cr = await fetch(`${DESTY_API}/order-center/package/status/count`, { method: 'POST' });
        const cj = await cr.json();
        if (cj.code === 0) {
          const d = cj.data;
          setCounts({
            ready_to_ship: +d.readyToShip, processed: +d.processed,
            to_process: +d.toProcess, in_delivery: +d.inDelivery,
            delivered: +d.delivered, shipping: +d.shipping, unpaid: +d.unpaid,
          });
        }
      } catch (e) {
        console.warn('Desty counts failed, using DB fallback:', e);
        const { count: processedCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'Processed');
        setCounts({ ready_to_ship: processedCount || 0, processed: processedCount || 0, to_process: 0, in_delivery: 0, delivered: 0, shipping: 0, unpaid: 0 });
      }

      // 2. ALL Processed orders (try proxy first, fallback DB)
      let orders: DestyOrder[] = [];
      try {
        for (let pg = 1; pg <= 10; pg++) {
          const or = await fetch(`${DESTY_API}/order-center/package/list`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current: pg, size: 50, status: 'Processed' }),
          });
          const oj = await or.json();
          const recs = oj?.data?.records;
          if (!recs || recs.length === 0) break;
          orders.push(...recs);
        }
        if (orders.length === 0) throw new Error('empty');
      } catch (e) {
        console.warn('Desty orders failed, using DB fallback:', e);
        // Fallback: fetch from Supabase
        const { data: dbOrders } = await supabase
          .from('orders')
          .select('*')
          .eq('order_status', 'Processed')
          .order('order_create_time', { ascending: false });
        const { data: dbItems } = await supabase.from('order_items').select('*');
        const itemsByOrder: Record<string, any[]> = {};
        (dbItems || []).forEach(i => { if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = []; itemsByOrder[i.order_id].push(i); });
        orders = (dbOrders || []).map((o: any) => {
          const oItems = itemsByOrder[o.id] || [];
          return {
            orderId: o.desty_order_id, displayedOrderSn: o.order_sn, status: o.order_status,
            platformName: o.platform, externalShopName: o.store_name,
            totalPrice: o.total_price, paymentMethod: o.cod_order ? 'Cash on delivery' : '',
            shipmentNo: oItems[0]?.tracking_number || '', courier: oItems[0]?.courier || '',
            recipientInfo: { name: o.customer_name, address: { fullAddress: o.shipping_address, city: o.shipping_city } },
            orderCreateTime: o.order_create_time ? new Date(o.order_create_time).getTime() : 0,
            items: oItems.map((i: any) => ({ productName: i.item_name, quantity: i.quantity })),
          };
        });
      }
      setAllOrders(orders);

      // 3. Scanned resis from Supabase
      const { data: scans } = await supabase.from('scans').select('resi').eq('status', 'KELUAR');
      const scannedSet = new Set<string>();
      (scans || []).forEach(s => { if (s.resi) scannedSet.add(s.resi.trim().toUpperCase()); });
      setScannedResis(scannedSet);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── STATS from ALL live orders ──
  const stats = useMemo((): PageStats => {
    const byStore: Record<string, StoreInfo> = {};
    let clearCount = 0;

    allOrders.forEach(o => {
      const store = o.externalShopName || 'Tanpa Nama';
      if (!byStore[store]) byStore[store] = { platform: o.platformName, total: 0, clear: 0, resis: [] };

      const tn = (o.shipmentNo || '').trim().toUpperCase();
      const hasResi = tn.length > 3;

      byStore[store].total++;
      if (hasResi) {
        byStore[store].resis.push(tn);
        if (scannedResis.has(tn)) {
          byStore[store].clear++;
          clearCount++;
        }
      }
    });

    return {
      total: allOrders.length,
      clear: clearCount,
      belum: allOrders.length - clearCount,
      byStore,
    };
  }, [allOrders, scannedResis]);

  // ── FILTERED + PAGINATED for table ──
  const filtered = useMemo(() => {
    let f = [...allOrders];
    if (platformFilter !== 'all') f = f.filter(o => o.platformName === platformFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(o =>
        (o.recipientInfo?.name || '').toLowerCase().includes(q) ||
        (o.displayedOrderSn || '').toLowerCase().includes(q) ||
        (o.shipmentNo || '').toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'oldest': f.sort((a, b) => (a.orderCreateTime || 0) - (b.orderCreateTime || 0)); break;
      case 'price': f.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0)); break;
      case 'customer': f.sort((a, b) => (a.recipientInfo?.name || '').localeCompare(b.recipientInfo?.name || '')); break;
      case 'store': f.sort((a, b) => (a.externalShopName || '').localeCompare(b.externalShopName || '')); break;
      default: f.sort((a, b) => (b.orderCreateTime || 0) - (a.orderCreateTime || 0));
    }
    return f;
  }, [allOrders, platformFilter, searchQuery, sortBy]);

  const pageOrders = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
  const totalFiltered = filtered.length;

  const platforms = useMemo(() => [...new Set(allOrders.map(o => o.platformName))].filter(Boolean).sort(), [allOrders]);
  const storeList = useMemo(() => Object.entries(stats.byStore).sort((a, b) => b[1].total - a[1].total), [stats]);

  // Per Produk breakdown
  const productBreakdown = useMemo(() => {
    const byProduct: Record<string, { total: number; clear: number; resis: string[]; stores: Set<string> }> = {};
    allOrders.forEach(o => {
      const tn = (o.shipmentNo || '').trim().toUpperCase();
      const hasResi = tn.length > 3;
      const scanned = hasResi && scannedResis.has(tn);
      (o.items || []).forEach(item => {
        const name = item.productName || 'Tanpa Nama';
        if (!byProduct[name]) byProduct[name] = { total: 0, clear: 0, resis: [], stores: new Set() };
        byProduct[name].total++;
        if (hasResi) {
          byProduct[name].resis.push(tn);
          if (scanned) byProduct[name].clear++;
        }
        byProduct[name].stores.add(o.externalShopName || '');
      });
    });
    // Dedupe resis per product
    Object.values(byProduct).forEach(p => { p.resis = [...new Set(p.resis)]; });
    return Object.entries(byProduct).sort((a, b) => b[1].total - a[1].total);
  }, [allOrders, scannedResis]);

  const isClear = (o: DestyOrder) => {
    const tn = (o.shipmentNo || '').trim().toUpperCase();
    return tn.length > 3 && scannedResis.has(tn);
  };

  // ── EXPORT ──
  const exportCSV = () => {
    const rows = [['Toko', 'Platform', 'Total', 'Clear (Scan Staff)', 'Belum', 'Resi']];
    storeList.forEach(([name, d]) => {
      rows.push([name, d.platform, String(d.total), String(d.clear), String(d.total - d.clear), d.resis.join('; ')]);
    });
    rows.push([]);
    rows.push(['TOTAL', '', String(stats.total), String(stats.clear), String(stats.belum), '']);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `antrian-pengiriman-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>📋 Antrian Pengiriman</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {dayjs().format('dddd, DD MMMM YYYY')} • Live Desty + Scan Staff
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportCSV} className="btn btn-outline" title="Export CSV"><Download size={18} /> Export</button>
          <button onClick={fetchAll} className="btn btn-outline"><RefreshCw size={18} /> Segarkan</button>
        </div>
      </div>

      {/* COUNT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <CC icon={<PackageSearch size={20} />} label="Total Order" value={counts?.ready_to_ship ?? '...'} color="#6366f1" sub="Siap Dikirim" />
        <CC icon={<PackageCheck size={20} />} label="Ada Resi" value={counts?.processed ?? '...'} color="var(--success)" sub="Telah Diproses" />
        <CC icon={<AlertCircle size={20} />} label="Belum Ada Resi" value={counts?.to_process ?? '...'} color="#f59e0b" sub="Perlu Diproses" />
        <CC icon={<Truck size={20} />} label="Scan Kurir" value={counts?.in_delivery ?? '...'} color="#0ea5e9" sub="In Delivery" />
        <CC icon={<Home size={20} />} label="Diterima" value={counts?.delivered ?? '...'} color="#8b5cf6" sub="Delivered" />
        <CC icon={<Hash size={20} />} label="Total Shipping" value={counts?.shipping ?? '...'} color="#64748b" sub="All time" />
      </div>

      {/* SCAN PROGRESS — dari LIVE orders + scans kita */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>📊 Progress Scan Staff</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{stats.total}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Resi</div></div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{stats.clear}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✅ Sudah Scan</div></div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.belum > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{stats.belum}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>⏳ Belum</div></div>
        </div>
        {stats.total > 0 && (
          <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(stats.clear / stats.total) * 100}%`, background: stats.clear === stats.total ? 'var(--success)' : 'var(--primary)', borderRadius: '6px', transition: 'width 0.5s' }} />
          </div>
        )}
      </div>

      {/* PER TOKO */}
      {storeList.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>🏪 Per Toko ({storeList.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.4rem' }}>
            {storeList.map(([name, d]) => (
              <div key={name} style={{ padding: '0.5rem 0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(PLATFORM_ICONS[d.platform] || '📦')} {name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.total} order • {d.resis.length} resi</div>
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--success)', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>✅{d.clear}</span>
                  <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⏳{d.total - d.clear}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PER PRODUK */}
      {productBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>📦 Per Produk ({productBreakdown.length} produk)</div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {productBreakdown.map(([name, d]) => (
              <div key={name} style={{ padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: d.resis.length > 0 ? '0.4rem' : 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {d.total} pcs • {[...d.stores].join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--success)', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>✅{d.clear}</span>
                    <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⏳{d.resis.length - d.clear}</span>
                  </div>
                </div>
                {d.resis.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {d.resis.map(r => {
                      const scanned = scannedResis.has(r.toUpperCase());
                      return (
                        <span key={r} style={{
                          fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700,
                          padding: '0.15rem 0.4rem', borderRadius: '4px',
                          background: scanned ? '#dcfce7' : '#fef3c7',
                          color: scanned ? '#166534' : '#92400e',
                        }}>
                          {scanned ? '✅' : '⏳'} {r}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.6rem', transform: 'translateY(-50%)' }} />
          <input type="text" className="input" placeholder="Cari customer / resi..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} style={{ paddingLeft: '2rem', fontSize: '0.85rem' }} />
        </div>
        <select className="input" value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setPage(0); }} style={{ width: 'auto', fontSize: '0.85rem' }}>
          <option value="all">Semua</option>
          {platforms.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p] || ''} {p}</option>)}
        </select>
        <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ width: 'auto', fontSize: '0.85rem' }}>
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="price">Harga ↓</option>
          <option value="customer">Nama A-Z</option>
          <option value="store">Toko A-Z</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalFiltered} order</span>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} /><p style={{ color: 'var(--text-muted)' }}>Memuat...</p></div>
        ) : pageOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Tidak ada data.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: 'white' }}>
                  <th style={{ padding: '0.5rem', width: '40px' }}>#</th>
                  <th style={{ padding: '0.5rem', width: '45px' }}></th>
                  <th style={{ padding: '0.5rem' }}>Customer / Order</th>
                  <th style={{ padding: '0.5rem', minWidth: '140px' }}>Resi</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '90px' }}>Total</th>
                  <th style={{ padding: '0.5rem', width: '30px' }}></th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((o, idx) => {
                  const clear = isClear(o);
                  return (
                    <>
                      <tr key={o.orderId} onClick={() => setExpandedOrder(expandedOrder === o.orderId ? null : o.orderId)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: clear ? '#f0fdf4' : 'white' }}>
                        <td style={{ padding: '0.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{page * PAGE_SIZE + idx + 1}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                          {clear ? <CheckCircle2 size={16} color="#16a34a" /> : <Clock size={16} color="#f59e0b" />}
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{o.recipientInfo?.name || '-'}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {(PLATFORM_ICONS[o.platformName] || '')} {o.externalShopName} • {o.displayedOrderSn}
                          </div>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          {(o.shipmentNo || '').trim() ? (
                            <div>
                              <span style={{ fontWeight: 700, color: clear ? '#16a34a' : 'var(--primary)', fontSize: '0.78rem' }}>{o.shipmentNo}</span>
                              {o.courier && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>🚚 {o.courier}</div>}
                            </div>
                          ) : <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          Rp {(o.totalPrice || 0).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                          {expandedOrder === o.orderId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expandedOrder === o.orderId && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0.6rem', background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem' }}>
                              <div style={{ marginBottom: '0.4rem', padding: '0.4rem', background: '#eff6ff', borderRadius: '6px' }}>
                                <strong>📍</strong> {o.recipientInfo?.address?.fullAddress || '—'}<br />
                                <strong>💰</strong> {o.paymentMethod === 'Cash on delivery' ? 'COD' : 'Non-COD'} • {o.items?.length || 0} item • 🏪 {o.externalShopName}
                              </div>
                              {(o.items || []).map((item, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: i < (o.items?.length || 0) - 1 ? '1px solid #e2e8f0' : 'none' }}>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>x{item.quantity}</div>
                                  </div>
                                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: isClear(o) ? '#16a34a' : 'var(--primary)' }}>
                                    {o.shipmentNo ? <>{isClear(o) ? '✅' : '⏳'} {o.shipmentNo}</> : '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            {/* PAGINATION */}
            {totalFiltered > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage(0)} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>««</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>«</button>
                <span style={{ padding: '0.3rem 0.6rem', fontWeight: 700, fontSize: '0.8rem' }}>Hal {page + 1}/{Math.ceil(totalFiltered / PAGE_SIZE)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalFiltered} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»</button>
                <button onClick={() => setPage(Math.floor(totalFiltered / PAGE_SIZE))} disabled={(page + 1) * PAGE_SIZE >= totalFiltered} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»»</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CC({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number | string; color: string; sub: string }) {
  return (
    <div className="card" style={{ padding: '0.7rem', textAlign: 'center', borderTop: `3px solid ${color}` }}>
      <div style={{ color, marginBottom: '0.2rem' }}>{icon}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}
