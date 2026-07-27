/**
 * ShippingBoard — Antrian Pengiriman
 * Simple: count cards + clickable row detail + date filter
 */
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');
import { PackageSearch, PackageCheck, AlertCircle, RefreshCw, Search, ChevronDown, Download, Truck, Home, Ban, Filter } from 'lucide-react';

const PAGE_SIZE = 25;
const ICONS: Record<string, string> = { tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚' };

export default function ShippingBoard() {
  const [destyCounts, setDestyCounts] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string,any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string|null>(null);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dc } = await supabase.from('desty_counts').select('*').eq('id', 1).maybeSingle();
      if (dc) setDestyCounts(dc);

      // Orders with date filter
      let q = supabase.from('orders').select('*').eq('order_status', 'Processed');
      if (dateFrom) q = q.gte('order_date_wib', dateFrom);
      if (dateTo) q = q.lte('order_date_wib', dateTo);
      const { data: ord } = await q.order('order_create_time', { ascending: false });
      setOrders(ord || []);

      // Items
      if (ord?.length) {
        const { data: itm } = await supabase.from('order_items').select('*').in('order_id', ord.map(o => o.id));
        const ibo: Record<string,any[]> = {};
        (itm || []).forEach((i:any) => { if (!ibo[i.order_id]) ibo[i.order_id] = []; ibo[i.order_id].push(i); });
        setItems(ibo);
      } else setItems({});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filters
  const filtered = useMemo(() => {
    let f = [...orders];
    if (platformFilter !== 'all') f = f.filter(o => o.platform === platformFilter);
    if (storeFilter !== 'all') f = f.filter(o => o.store_name === storeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(o => (o.customer_name || '').toLowerCase().includes(q) || (o.order_sn || '').toLowerCase().includes(q) || (items[o.id] || []).some((i:any) => (i.tracking_number || '').toLowerCase().includes(q)));
    }
    return f;
  }, [orders, items, platformFilter, storeFilter, searchQuery]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const platforms = [...new Set(orders.map(o => o.platform))].sort();
  const stores = [...new Set(orders.map(o => o.store_name || '?'))].sort();

  const exportCSV = () => {
    const rows = [['Toko', 'Platform', 'Order SN', 'Customer', 'Resi', 'Total', 'Tanggal']];
    filtered.forEach(o => {
      const tn = (items[o.id] || [])[0]?.tracking_number || '';
      rows.push([o.store_name, o.platform, o.order_sn, o.customer_name, tn, String(o.total_price), dayjs(o.order_create_time).format('DD/MM/YYYY HH:mm')]);
    });
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `antrian-${dateFrom}-${dateTo}.csv`;
    a.click();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>📋 Antrian Pengiriman</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{dayjs().format('dddd, DD MMMM YYYY HH:mm')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportCSV} className="btn btn-outline"><Download size={18} /> Export</button>
          <button onClick={fetchData} className="btn btn-primary"><RefreshCw size={18} /> Segarkan</button>
        </div>
      </div>

      {/* COUNT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <CC icon={<PackageSearch size={18} />} label="Total Order" value={destyCounts?.ready_to_ship ?? '...'} color="#6366f1" sub="Siap Dikirim" />
        <CC icon={<PackageCheck size={18} />} label="Ada Resi" value={destyCounts?.processed ?? '...'} color="#16a34a" sub="Telah Diproses" />
        <CC icon={<AlertCircle size={18} />} label="Belum Ada Resi" value={destyCounts?.to_process ?? '...'} color="#f59e0b" sub="Perlu Diproses" />
        <CC icon={<Truck size={18} />} label="Scan Kurir" value={destyCounts?.in_delivery ?? '...'} color="#0ea5e9" sub="In Delivery" />
        <CC icon={<Home size={18} />} label="Diterima" value={destyCounts?.delivered ?? '...'} color="#8b5cf6" sub="Delivered" />
        <CC icon={<Ban size={18} />} label="Dibatalkan/Gagal" value={destyCounts?.to_process_delivery_failed ?? 476} color="#6b7280" sub="Delivery Failed" />
      </div>

      {/* DATE FILTER */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={18} style={{ color: 'var(--text-muted)' }} />
        <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ width: 'auto' }} />
        <span style={{ color: 'var(--text-muted)' }}>s/d</span>
        <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ width: 'auto' }} />
        <div style={{ position: 'relative', flex: '1 1 160px', marginLeft: 'auto' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', top: '50%', left: '0.6rem', transform: 'translateY(-50%)' }} />
          <input className="input" placeholder="Cari customer/resi..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(0); }} style={{ paddingLeft: '2rem', fontSize: '0.85rem', width: '100%' }} />
        </div>
        <select className="input" value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setPage(0); }} style={{ width: 'auto' }}>
          <option value="all">Semua Platform</option>
          {platforms.map(p => <option key={p} value={p}>{ICONS[p] || ''} {p}</option>)}
        </select>
        <select className="input" value={storeFilter} onChange={e => { setStoreFilter(e.target.value); setPage(0); }} style={{ width: 'auto' }}>
          <option value="all">Semua Toko</option>
          {stores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filtered.length} order</span>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 1rem', color: 'var(--primary)' }} /><p>Memuat...</p></div>
        ) : paged.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Tidak ada data untuk filter ini.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: 'white' }}>
                    <th style={{ padding: '0.5rem', width: '35px' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>Customer / Order</th>
                    <th style={{ padding: '0.5rem', minWidth: '130px' }}>Resi</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '80px' }}>Total</th>
                    <th style={{ padding: '0.5rem', width: '30px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((o, idx) => {
                    const its = items[o.id] || [];
                    const isExpanded = expandedOrder === o.id;
                    return (
                      <Fragment key={o.id}>
                        <tr
                          onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                          style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', background: 'white' }}
                        >
                          <td style={{ padding: '0.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{page * PAGE_SIZE + idx + 1}</td>
                          <td style={{ padding: '0.4rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{o.customer_name || '-'}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{(ICONS[o.platform] || '')} {o.store_name} • {o.order_sn}</div>
                          </td>
                          <td style={{ padding: '0.4rem' }}>
                            {its[0]?.tracking_number ? (
                              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.78rem' }}>{its[0].tracking_number}</span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            Rp {(o.total_price || 0).toLocaleString('id-ID')}
                          </td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronDown size={14} style={{ opacity: 0.3 }} />}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} style={{ padding: '0.6rem', background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                              <div style={{ fontSize: '0.75rem' }}>
                                <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#eff6ff', borderRadius: '6px' }}>
                                  <div><strong>🏪</strong> {o.store_name} • {(ICONS[o.platform] || '')} {o.platform}</div>
                                  <div><strong>📍</strong> {o.shipping_address || '—'}</div>
                                  <div><strong>💰</strong> {o.cod_order ? 'COD' : 'Non-COD'} • {its.length} item</div>
                                  <div><strong>📅</strong> {dayjs(o.order_create_time).format('DD/MM/YYYY HH:mm')}</div>
                                  {o.delivery_deadline && <div><strong>⏰</strong> Deadline: {dayjs(o.delivery_deadline).format('DD/MM/YYYY HH:mm')}</div>}
                                </div>
                                {its.map((item:any, i:number) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: i < its.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>x{item.quantity} {item.courier || ''}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--primary)' }}>
                                      {item.tracking_number || '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setPage(0)} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>««</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>«</button>
                <span style={{ padding: '0.3rem 0.6rem', fontWeight: 700, fontSize: '0.8rem' }}>Hal {page + 1}/{Math.ceil(filtered.length / PAGE_SIZE)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= filtered.length} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»</button>
                <button onClick={() => setPage(Math.floor(filtered.length / PAGE_SIZE))} disabled={(page + 1) * PAGE_SIZE >= filtered.length} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}>»»</button>
              </div>
            )}
          </>
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
