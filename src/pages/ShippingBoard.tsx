/**
 * ShippingBoard — Antrian Pengiriman (Supabase-only, no proxy)
 * Data synced by cron job every 2 minutes from Desty
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
  PackageSearch, Clock, CheckCircle2,
  RefreshCw, Search, ChevronDown, ChevronUp,
  PackageCheck, Download
} from 'lucide-react';

dayjs.locale('id');
const PAGE_SIZE = 30;

// ============================================================
// TYPES
// ============================================================
interface OrderRow {
  id: string; desty_order_id: string; order_sn: string;
  platform: string; platform_name: string; store_name: string;
  order_status: string; customer_name: string;
  shipping_city: string; shipping_address: string;
  total_price: number; cod_order: boolean;
  order_create_time: string;
  items: ItemRow[];
}
interface ItemRow {
  id: string; order_id: string; item_name: string; quantity: number;
  tracking_number: string | null; courier: string | null;
}

interface StoreStats { platform: string; total: number; clear: number; resis: string[] }
interface ProductStats { total: number; clear: number; resis: string[]; stores: string[] }

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚',
};

// ============================================================
// COMPONENT
// ============================================================
export default function ShippingBoard() {
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
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
    
    // 1. ALL scanned resis
    const { data: scans } = await supabase.from('scans').select('resi').eq('status', 'KELUAR');
    const scannedSet = new Set<string>();
    (scans || []).forEach(s => { if (s.resi) scannedSet.add(s.resi.trim().toUpperCase()); });
    setScannedResis(scannedSet);

    // 2. ALL Processed orders + items from Supabase
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('order_status', 'Processed')
      .order('order_create_time', { ascending: false });

    if (orders && orders.length > 0) {
      const oids = orders.map(o => o.id);
      const { data: items } = await supabase.from('order_items').select('*').in('order_id', oids);
      const itemsByOrder: Record<string, ItemRow[]> = {};
      (items || []).forEach(i => {
        if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
        itemsByOrder[i.order_id].push(i);
      });
      setAllOrders(orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] })));
    } else {
      setAllOrders([]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── COMPUTED ──
  const totalOrders = allOrders.length;

  const isClear = (o: OrderRow) => {
    const tns = o.items.map(i => i.tracking_number?.trim().toUpperCase()).filter((t): t is string => !!t && t.length > 3);
    return tns.length > 0 && tns.every(t => scannedResis.has(t));
  };

  const clearCount = allOrders.filter(o => isClear(o)).length;
  const belumCount = totalOrders - clearCount;

  // Per Toko
  const storeBreakdown = useMemo(() => {
    const m: Record<string, StoreStats> = {};
    allOrders.forEach(o => {
      const name = o.store_name || 'Tanpa Nama';
      if (!m[name]) m[name] = { platform: o.platform, total: 0, clear: 0, resis: [] };
      m[name].total++;
      if (isClear(o)) m[name].clear++;
      o.items.forEach(i => {
        const tn = (i.tracking_number || '').trim().toUpperCase();
        if (tn.length > 3) m[name].resis.push(tn);
      });
    });
    Object.values(m).forEach(s => { s.resis = [...new Set(s.resis)]; });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [allOrders, scannedResis]);

  // Per Produk
  const productBreakdown = useMemo(() => {
    const m: Record<string, ProductStats> = {};
    allOrders.forEach(o => {
      const tn = (o.items[0]?.tracking_number || '').trim().toUpperCase();
      const hasResi = tn.length > 3;
      const scanned = hasResi && scannedResis.has(tn);
      o.items.forEach(item => {
        const name = item.item_name || 'Tanpa Nama';
        if (!m[name]) m[name] = { total: 0, clear: 0, resis: [], stores: [] };
        m[name].total += item.quantity || 1;
        if (hasResi) {
          m[name].resis.push(tn);
          if (scanned) m[name].clear++;
        }
        if (!m[name].stores.includes(o.store_name)) m[name].stores.push(o.store_name);
      });
    });
    Object.values(m).forEach(p => { p.resis = [...new Set(p.resis)]; });
    return Object.entries(m).sort((a, b) => b[1].total - a[1].total);
  }, [allOrders, scannedResis]);

  // Filter + sort + page
  const filtered = useMemo(() => {
    let f = [...allOrders];
    if (platformFilter !== 'all') f = f.filter(o => o.platform === platformFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(o =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.order_sn || '').toLowerCase().includes(q) ||
        o.items.some(i => (i.tracking_number || '').toLowerCase().includes(q))
      );
    }
    switch (sortBy) {
      case 'oldest': f.sort((a, b) => new Date(a.order_create_time).getTime() - new Date(b.order_create_time).getTime()); break;
      case 'price': f.sort((a, b) => (b.total_price || 0) - (a.total_price || 0)); break;
      case 'customer': f.sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '')); break;
      case 'store': f.sort((a, b) => (a.store_name || '').localeCompare(b.store_name || '')); break;
      default: f.sort((a, b) => new Date(b.order_create_time).getTime() - new Date(a.order_create_time).getTime());
    }
    return f;
  }, [allOrders, platformFilter, searchQuery, sortBy]);

  const pageOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalFiltered = filtered.length;
  const platforms = [...new Set(allOrders.map(o => o.platform))].sort();

  // Export CSV
  const exportCSV = () => {
    const rows = [['Toko', 'Platform', 'Total', 'Clear', 'Belum', 'Resi']];
    storeBreakdown.forEach(([name, d]) => {
      rows.push([name, d.platform, String(d.total), String(d.clear), String(d.total - d.clear), d.resis.join('; ')]);
    });
    rows.push([]);
    rows.push(['TOTAL', '', String(totalOrders), String(clearCount), String(belumCount), '']);
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `antrian-pengiriman-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>📋 Antrian Pengiriman</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {dayjs().format('dddd, DD MMMM YYYY')} • Synced from Desty tiap 2 menit
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportCSV} className="btn btn-outline"><Download size={18} /> Export</button>
          <button onClick={fetchAll} className="btn btn-outline"><RefreshCw size={18} /> Segarkan</button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <CC icon={<PackageSearch size={20} />} label="Total Order" value={totalOrders} color="#6366f1" sub="Siap Dikirim" />
        <CC icon={<PackageCheck size={20} />} label="Ada Resi" value={totalOrders} color="var(--success)" sub="Telah Diproses" />
        <CC icon={<CheckCircle2 size={20} />} label="Clear (Scan Staff)" value={clearCount} color="#16a34a" sub="Sudah discan" />
        <CC icon={<Clock size={20} />} label="Belum Scan" value={belumCount} color={belumCount > 0 ? 'var(--danger)' : 'var(--text-muted)'} sub="Menunggu staff" />
      </div>

      {/* PROGRESS BAR */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>📊 Progress Scan</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '0.75rem', textAlign: 'center' }}>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{totalOrders}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total</div></div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{clearCount}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✅ Clear</div></div>
          <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: belumCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{belumCount}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>⏳ Belum</div></div>
        </div>
        {totalOrders > 0 && (
          <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(clearCount / totalOrders) * 100}%`, background: clearCount === totalOrders ? 'var(--success)' : 'var(--primary)', borderRadius: '6px', transition: 'width 0.5s' }} />
          </div>
        )}
      </div>

      {/* PER TOKO */}
      {storeBreakdown.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>🏪 Per Toko ({storeBreakdown.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.4rem' }}>
            {storeBreakdown.map(([n, d]) => (
              <div key={n} style={{ padding: '0.5rem 0.6rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(PLATFORM_ICONS[d.platform] || '📦')} {n}</div>
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
          <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.75rem' }}>📦 Per Produk ({productBreakdown.length})</div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {productBreakdown.map(([n, d]) => (
              <div key={n} style={{ padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: d.resis.length > 0 ? '0.4rem' : 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{n}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{d.total} pcs • {d.stores.join(', ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--success)', background: '#dcfce7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>✅{d.clear}</span>
                    <span style={{ color: '#92400e', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>⏳{d.resis.length - d.clear}</span>
                  </div>
                </div>
                {d.resis.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {d.resis.map(r => {
                      const scanned = scannedResis.has(r);
                      return <span key={r} style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', background: scanned ? '#dcfce7' : '#fef3c7', color: scanned ? '#166534' : '#92400e' }}>{scanned ? '✅' : '⏳'} {r}</span>;
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
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{allOrders.length === 0 ? 'Belum ada data. Jalankan cron sync.' : 'Tidak cocok.'}</div>
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
                      <tr key={o.id} onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: clear ? '#f0fdf4' : 'white' }}>
                        <td style={{ padding: '0.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{page * PAGE_SIZE + idx + 1}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>{clear ? <CheckCircle2 size={16} color="#16a34a" /> : <Clock size={16} color="#f59e0b" />}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{o.customer_name || '-'}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(PLATFORM_ICONS[o.platform] || '')} {o.store_name} • {o.order_sn}</div>
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          {o.items[0]?.tracking_number ? (
                            <div><span style={{ fontWeight: 700, color: clear ? '#16a34a' : 'var(--primary)', fontSize: '0.78rem' }}>{o.items[0].tracking_number}</span>
                              {o.items[0].courier && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>🚚 {o.items[0].courier}</div>}</div>
                          ) : <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Rp {(o.total_price || 0).toLocaleString('id-ID')}</td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>{expandedOrder === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                      </tr>
                      {expandedOrder === o.id && (
                        <tr><td colSpan={6} style={{ padding: '0.6rem', background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                          <div style={{ fontSize: '0.75rem' }}>
                            <div style={{ marginBottom: '0.4rem', padding: '0.4rem', background: '#eff6ff', borderRadius: '6px' }}>
                              <strong>📍</strong> {o.shipping_address || '—'}<br />
                              <strong>💰</strong> {o.cod_order ? 'COD' : 'Non-COD'} • {o.items.length} item • 🏪 {o.store_name}
                            </div>
                            {o.items.map((item, i) => {
                              const tn = (item.tracking_number || '').trim().toUpperCase();
                              const scanned = tn && scannedResis.has(tn);
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: i < o.items.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                                  <div><div style={{ fontWeight: 600 }}>{item.item_name}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>x{item.quantity} {item.courier || ''}</div></div>
                                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: scanned ? '#16a34a' : 'var(--primary)' }}>{tn ? <>{scanned ? '✅' : '⏳'} {tn}</> : '—'}</div>
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
