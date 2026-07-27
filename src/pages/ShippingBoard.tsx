/**
 * ShippingBoard — Antrian Pengiriman
 * Data dari Supabase (synced cron tiap 2 menit)
 * Counts dari desty_counts table (diupdate cron)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import {
  PackageSearch, Clock, CheckCircle2, AlertCircle,
  RefreshCw, Search, ChevronDown, ChevronUp, Calendar,
  PackageCheck, Download, Truck, Home, Hash
} from 'lucide-react';

dayjs.locale('id');
const PAGE_SIZE = 30;

interface OrderRow {
  id: string; desty_order_id: string; order_sn: string;
  platform: string; platform_name: string; store_name: string;
  order_status: string; customer_name: string;
  shipping_city: string; shipping_address: string;
  total_price: number; cod_order: boolean;
  order_create_time: string; delivery_deadline: string|null;
  items: ItemRow[];
}
interface ItemRow {
  id: string; order_id: string; item_name: string; quantity: number;
  tracking_number: string | null; courier: string | null;
}
interface DestyCounts { ready_to_ship: number; processed: number; to_process: number; in_delivery: number; delivered: number; shipping: number; }

const ICONS: Record<string, string> = { tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚' };

export default function ShippingBoard() {
  const [destyCounts, setDestyCounts] = useState<DestyCounts | null>(null);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [scannedResis, setScannedResis] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest'|'oldest'|'price'|'customer'|'store'>('newest');
  const [expandedOrder, setExpandedOrder] = useState<string|null>(null);
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const todayStart = dayjs().startOf('day');
  const now = dayjs();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Desty counts
      const { data: dc } = await supabase.from('desty_counts').select('*').eq('id', 1).maybeSingle();
      if (dc) setDestyCounts(dc);

      // Scanned resis (paginated — load all 19k+)
      const ss = new Set<string>();
      let off = 0;
      while (true) {
        const { data: scans } = await supabase.from('scans').select('resi').eq('status', 'KELUAR').range(off, off + 999);
        if (!scans || scans.length === 0) break;
        scans.forEach((s:any)=>{if(s.resi)ss.add(s.resi.trim().toUpperCase());});
        off += 1000;
      }
      setScannedResis(ss);

      // Orders with optional date filter
      let q = supabase.from('orders').select('*').eq('order_status', 'Processed');
      if (dateFrom) q = q.gte('order_create_time', dateFrom);
      if (dateTo) q = q.lte('order_create_time', dateTo + 'T23:59:59');
      const { data: orders } = await q.order('order_create_time', { ascending: false });
      if (orders?.length) {
        const oids = orders.map(o=>o.id);
        const { data: items } = await supabase.from('order_items').select('*').in('order_id', oids);
        const ibo: Record<string,ItemRow[]> = {};
        (items||[]).forEach(i=>{if(!ibo[i.order_id])ibo[i.order_id]=[];ibo[i.order_id].push(i);});
        setAllOrders(orders.map(o=>({...o,items:ibo[o.id]||[]})));
      } else setAllOrders([]);
    } catch(e){ console.error(e); }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const isClear = (o:OrderRow)=> o.items.map(i=>i.tracking_number?.trim().toUpperCase()).filter((t):t is string=>!!t&&t.length>3).every(t=>scannedResis.has(t));
  const total = allOrders.length, clear = allOrders.filter(o=>isClear(o)).length, belum = total-clear;

  // Per toko
  const storeBreakdown = useMemo(()=>{
    const m: Record<string,{platform:string;total:number;clear:number;resis:string[]}> = {};
    allOrders.forEach(o=>{const n=o.store_name||'?';if(!m[n])m[n]={platform:o.platform,total:0,clear:0,resis:[]};m[n].total++;if(isClear(o))m[n].clear++;o.items.forEach(i=>{const t=(i.tracking_number||'').trim().toUpperCase();if(t.length>3)m[n].resis.push(t);});});
    Object.values(m).forEach(s=>{s.resis=[...new Set(s.resis)];});
    return Object.entries(m).sort((a,b)=>b[1].total-a[1].total);
  },[allOrders]);

  // Per produk
  const productBreakdown = useMemo(()=>{
    const m: Record<string,{total:number;clear:number;resis:string[];stores:string[]}> = {};
    allOrders.forEach(o=>{const tn=(o.items[0]?.tracking_number||'').trim().toUpperCase(),has=tn.length>3,sc=has&&scannedResis.has(tn);o.items.forEach(item=>{const n=item.item_name||'?';if(!m[n])m[n]={total:0,clear:0,resis:[],stores:[]};m[n].total+=item.quantity||1;if(has){m[n].resis.push(tn);if(sc)m[n].clear++;}if(!m[n].stores.includes(o.store_name))m[n].stores.push(o.store_name);});});
    Object.values(m).forEach(p=>{p.resis=[...new Set(p.resis)];});
    return Object.entries(m).sort((a,b)=>b[1].total-a[1].total);
  },[allOrders]);

  const filtered = useMemo(()=>{
    let f=[...allOrders];
    if(platformFilter!=='all')f=f.filter(o=>o.platform===platformFilter);
    if(searchQuery.trim()){const q=searchQuery.toLowerCase();f=f.filter(o=>(o.customer_name||'').toLowerCase().includes(q)||(o.order_sn||'').toLowerCase().includes(q)||o.items.some(i=>(i.tracking_number||'').toLowerCase().includes(q)));}
    switch(sortBy){case'oldest':f.sort((a,b)=>new Date(a.order_create_time).getTime()-new Date(b.order_create_time).getTime());break;case'price':f.sort((a,b)=>(b.total_price||0)-(a.total_price||0));break;case'customer':f.sort((a,b)=>(a.customer_name||'').localeCompare(b.customer_name||''));break;case'store':f.sort((a,b)=>(a.store_name||'').localeCompare(b.store_name||''));break;default:f.sort((a,b)=>new Date(b.order_create_time).getTime()-new Date(a.order_create_time).getTime());}
    return f;
  },[allOrders,platformFilter,searchQuery,sortBy]);

  const paged=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const platforms=[...new Set(allOrders.map(o=>o.platform))].sort();
  const totalFiltered=filtered.length;

  const exportCSV = ()=>{
    const rows=[['Toko','Platform','Total','Clear','Belum','Resi']];
    storeBreakdown.forEach(([n,d])=>{rows.push([n,d.platform,String(d.total),String(d.clear),String(d.total-d.clear),d.resis.join(';')]);});
    rows.push([],['TOTAL','',String(total),String(clear),String(belum),'']);
    const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`antrian-${dayjs().format('YYYY-MM-DD')}.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
      <div><h1 className="page-title" style={{margin:0}}>📋 Antrian Pengiriman</h1><p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>{dayjs().format('dddd, DD MMMM YYYY')} • Synced tiap 2 menit</p></div>
      <div style={{display:'flex',gap:'0.5rem'}}><button onClick={exportCSV} className="btn btn-outline"><Download size={18}/> Export</button><button onClick={fetchAll} className="btn btn-outline"><RefreshCw size={18}/> Segarkan</button></div>
    </div>

    {/* COUNT CARDS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
      <CC icon={<PackageSearch size={18}/>} label="Total Order" value={destyCounts?.ready_to_ship??'...'} color="#6366f1" sub="Siap Dikirim"/>
      <CC icon={<PackageCheck size={18}/>} label="Ada Resi" value={destyCounts?.processed??'...'} color="var(--success)" sub="Telah Diproses"/>
      <CC icon={<AlertCircle size={18}/>} label="Belum Ada Resi" value={destyCounts?.to_process??'...'} color="#f59e0b" sub="Perlu Diproses"/>
      <CC icon={<Truck size={18}/>} label="Scan Kurir" value={destyCounts?.in_delivery??'...'} color="#0ea5e9" sub="In Delivery"/>
      <CC icon={<Home size={18}/>} label="Diterima" value={destyCounts?.delivered??'...'} color="#8b5cf6" sub="Delivered"/>
      <CC icon={<Hash size={18}/>} label="Total Shipping" value={destyCounts?.shipping??'...'} color="#64748b" sub="All time"/>
    </div>

    {/* DEADLINE CARDS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
      <CC icon={<Clock size={18}/>} label="Deadline Hari Ini" value={allOrders.filter(o=>{const d=dayjs(o.delivery_deadline);return d.isValid()&&d.isSame(todayStart,'day');}).length} color="#f59e0b" sub="Harus dikirim hari ini"/>
      <CC icon={<AlertCircle size={18}/>} label="Terlambat" value={allOrders.filter(o=>{const d=dayjs(o.delivery_deadline);return d.isValid()&&d.isBefore(now);}).length} color="var(--danger)" sub="Melebihi deadline"/>
    </div>

    {/* PROGRESS BAR */}
    <div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}>
      <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:'0.5rem'}}>📊 Progress Scan Staff</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'1rem',marginBottom:'0.75rem',textAlign:'center'}}>
        <div><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--primary)'}}>{total}</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>Total Resi</div></div>
        <div><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--success)'}}>{clear}</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>✅ Clear</div></div>
        <div><div style={{fontSize:'1.5rem',fontWeight:800,color:belum>0?'var(--danger)':'var(--text-muted)'}}>{belum}</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>⏳ Belum</div></div>
        <div><div style={{fontSize:'1.5rem',fontWeight:800,color:'var(--primary)'}}>{total>0?Math.round(clear/total*100):0}%</div><div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>Progress</div></div>
      </div>
      {total>0&&<div style={{height:'12px',background:'#e2e8f0',borderRadius:'6px',overflow:'hidden'}}><div style={{height:'100%',width:`${(clear/total)*100}%`,background:clear===total?'var(--success)':'var(--primary)',borderRadius:'6px',transition:'width 0.5s'}}/></div>}
    </div>

    {/* PER TOKO */}
    {storeBreakdown.length>0&&<div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}>
      <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:'0.75rem'}}>🏪 Per Toko ({storeBreakdown.length})</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'0.4rem'}}>
        {storeBreakdown.map(([n,d])=><div key={n} style={{padding:'0.5rem 0.6rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.4rem'}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:'0.78rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(ICONS[d.platform]||'📦')} {n}</div><div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>{d.total} order • {d.resis.length} resi</div></div>
          <div style={{display:'flex',gap:'0.3rem',fontSize:'0.72rem',fontWeight:700}}><span style={{color:'var(--success)',background:'#dcfce7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>✅{d.clear}</span><span style={{color:'#92400e',background:'#fef3c7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>⏳{d.total-d.clear}</span></div>
        </div>)}
      </div>
    </div>}

    {/* PER TOKO — DEADLINE */}
    {(()=>{const dStores:Record<string,{total:number;today:number;late:number}>= {};allOrders.forEach(o=>{const s=o.store_name||'?';if(!dStores[s])dStores[s]={total:0,today:0,late:0};dStores[s].total++;if(o.delivery_deadline){const d=dayjs(o.delivery_deadline);if(d.isValid()&&d.isBefore(now))dStores[s].late++;if(d.isValid()&&d.isSame(todayStart,'day'))dStores[s].today++;}});const dl=Object.entries(dStores).sort((a,b)=>b[1].today+b[1].late-a[1].today-a[1].late);return dl.length>0?<div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}><div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:'0.75rem'}}>⏰ Deadline Per Toko</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'0.4rem'}}>{dl.map(([n,d])=><div key={n} style={{padding:'0.5rem 0.6rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.4rem'}}><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:'0.78rem'}}>{n}</div><div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>{d.total} order</div></div><div style={{display:'flex',gap:'0.3rem',fontSize:'0.72rem',fontWeight:700}}><span style={{color:'#92400e',background:'#fef3c7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🟡{d.today}</span><span style={{color:'#dc2626',background:'#fef2f2',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🔴{d.late}</span></div></div>)}</div></div>:null;})()}

    {/* PER PRODUK */}
    {productBreakdown.length>0&&<div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}>
      <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:'0.75rem'}}>📦 Per Produk ({productBreakdown.length})</div>
      <div style={{display:'grid',gap:'0.4rem'}}>
        {productBreakdown.map(([n,d])=><div key={n} style={{padding:'0.6rem 0.75rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid var(--border)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:d.resis.length>0?'0.4rem':0}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:'0.8rem'}}>{n}</div><div style={{fontSize:'0.68rem',color:'var(--text-muted)'}}>{d.total} pcs • {d.stores.join(', ')}</div></div>
            <div style={{display:'flex',gap:'0.3rem',fontSize:'0.72rem',fontWeight:700}}><span style={{color:'var(--success)',background:'#dcfce7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>✅{d.clear}</span><span style={{color:'#92400e',background:'#fef3c7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>⏳{d.resis.length-d.clear}</span></div>
          </div>
          {d.resis.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem'}}>{d.resis.map(r=>{const sc=scannedResis.has(r);return <span key={r} style={{fontSize:'0.7rem',fontFamily:'monospace',fontWeight:700,padding:'0.15rem 0.4rem',borderRadius:'4px',background:sc?'#dcfce7':'#fef3c7',color:sc?'#166534':'#92400e'}}>{sc?'✅':'⏳'} {r}</span>;})}</div>}
        </div>)}
      </div>
    </div>}

    {/* FILTERS */}
    <div className="card" style={{marginBottom:'1rem',display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center'}}>
      <div style={{position:'relative',flex:'1 1 180px'}}><Search size={16} color="var(--text-muted)" style={{position:'absolute',top:'50%',left:'0.6rem',transform:'translateY(-50%)'}}/><input className="input" placeholder="Cari..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}} style={{paddingLeft:'2rem',fontSize:'0.85rem'}}/></div>
      <select className="input" value={platformFilter} onChange={e=>{setPlatformFilter(e.target.value);setPage(0);}} style={{width:'auto',fontSize:'0.85rem'}}><option value="all">Semua</option>{platforms.map(p=><option key={p} value={p}>{ICONS[p]||''} {p}</option>)}</select>
      <select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value as any)} style={{width:'auto',fontSize:'0.85rem'}}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="price">Harga ↓</option><option value="customer">Nama A-Z</option><option value="store">Toko A-Z</option></select>
      <div style={{display:'flex',alignItems:'center',gap:'0.3rem'}}><Calendar size={14} color="var(--text-muted)"/><input type="date" className="input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:'130px',fontSize:'0.8rem'}}/><span style={{fontSize:'0.7rem'}}>s/d</span><input type="date" className="input" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:'130px',fontSize:'0.8rem'}}/></div>
      <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{totalFiltered} order</span>
    </div>

    {/* TABLE */}
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      {loading?<div style={{textAlign:'center',padding:'3rem'}}><RefreshCw className="animate-spin" size={32} style={{margin:'0 auto 1rem',color:'var(--primary)'}}/><p style={{color:'var(--text-muted)'}}>Memuat...</p></div>
      :paged.length===0?<div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)'}}>{allOrders.length===0?'Belum ada data. Jalankan sync.':'Tidak cocok.'}</div>
      :<div style={{overflowX:'auto'}}>
        <table style={{width:'100%',fontSize:'0.8rem',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#1e293b',color:'white'}}><th style={{padding:'0.5rem',width:'40px'}}>#</th><th style={{padding:'0.5rem',width:'45px'}}></th><th style={{padding:'0.5rem'}}>Customer / Order</th><th style={{padding:'0.5rem',minWidth:'140px'}}>Resi</th><th style={{padding:'0.5rem',textAlign:'right',minWidth:'90px'}}>Total</th><th style={{padding:'0.5rem',width:'30px'}}></th></tr></thead>
          <tbody>{paged.map((o,idx)=>{const cl=isClear(o);return <><tr key={o.id} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)} style={{cursor:'pointer',borderBottom:'1px solid var(--border)',background:cl?'#f0fdf4':'white'}}><td style={{padding:'0.4rem',textAlign:'center',color:'var(--text-muted)',fontSize:'0.7rem'}}>{page*PAGE_SIZE+idx+1}</td><td style={{padding:'0.4rem',textAlign:'center'}}>{cl?<CheckCircle2 size={16} color="#16a34a"/>:<Clock size={16} color="#f59e0b"/>}</td><td style={{padding:'0.4rem'}}><div style={{fontWeight:700,fontSize:'0.8rem'}}>{o.customer_name||'-'}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{(ICONS[o.platform]||'')} {o.store_name} • {o.order_sn}</div></td><td style={{padding:'0.4rem'}}>{o.items[0]?.tracking_number?<div><span style={{fontWeight:700,color:cl?'#16a34a':'var(--primary)',fontSize:'0.78rem'}}>{o.items[0].tracking_number}</span>{o.items[0].courier&&<div style={{fontSize:'0.6rem',color:'var(--text-muted)'}}>🚚 {o.items[0].courier}</div>}</div>:<span style={{color:'#94a3b8',fontSize:'0.7rem'}}>—</span>}</td><td style={{padding:'0.4rem',textAlign:'right',fontWeight:700,fontSize:'0.8rem',whiteSpace:'nowrap'}}>Rp {(o.total_price||0).toLocaleString('id-ID')}</td><td style={{padding:'0.4rem',textAlign:'center'}}>{expandedOrder===o.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</td></tr>
          {expandedOrder===o.id&&<tr><td colSpan={6} style={{padding:'0.6rem',background:'#f8fafc',borderBottom:'2px solid var(--border)'}}><div style={{fontSize:'0.75rem'}}><div style={{marginBottom:'0.4rem',padding:'0.4rem',background:'#eff6ff',borderRadius:'6px'}}><strong>📍</strong> {o.shipping_address||'—'}<br/><strong>💰</strong> {o.cod_order?'COD':'Non-COD'} • {o.items.length} item • 🏪 {o.store_name}<br/><small>📅 {dayjs(o.order_create_time).format('DD/MM/YYYY HH:mm')}</small></div>{o.items.map((item,i)=>{const t=(item.tracking_number||'').trim().toUpperCase(),sc=t&&scannedResis.has(t);return <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.25rem 0',borderBottom:i<o.items.length-1?'1px solid #e2e8f0':'none'}}><div><div style={{fontWeight:600}}>{item.item_name}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>x{item.quantity} {item.courier||''}</div></div><div style={{fontWeight:700,fontSize:'0.78rem',color:sc?'#16a34a':'var(--primary)'}}>{t?<>{sc?'✅':'⏳'} {t}</>:'—'}</div></div>;})}</div></td></tr>}</>;})}</tbody>
        </table>
        {totalFiltered>PAGE_SIZE&&<div style={{display:'flex',justifyContent:'center',gap:'0.3rem',padding:'0.75rem',borderTop:'1px solid var(--border)'}}><button onClick={()=>setPage(0)} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>««</button><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>«</button><span style={{padding:'0.3rem 0.6rem',fontWeight:700,fontSize:'0.8rem'}}>Hal {page+1}/{Math.ceil(totalFiltered/PAGE_SIZE)}</span><button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE_SIZE>=totalFiltered} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»</button><button onClick={()=>setPage(Math.floor(totalFiltered/PAGE_SIZE))} disabled={(page+1)*PAGE_SIZE>=totalFiltered} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»»</button></div>}
      </div>}
    </div>
  </div>;
}

function CC({icon,label,value,color,sub}:{icon:React.ReactNode;label:string;value:number|string;color:string;sub:string}){
  return <div className="card" style={{padding:'0.7rem',textAlign:'center',borderTop:`3px solid ${color}`}}><div style={{color,marginBottom:'0.2rem'}}>{icon}</div><div style={{fontSize:'1.3rem',fontWeight:800,color}}>{value}</div><div style={{fontSize:'0.65rem',fontWeight:700}}>{label}</div><div style={{fontSize:'0.55rem',color:'var(--text-muted)'}}>{sub}</div></div>;
}
