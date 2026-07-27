/**
 * ShippingBoard — Antrian Pengiriman + Deadline + Scan Tracking
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import isToday from 'dayjs/plugin/isToday';
dayjs.extend(isToday);
import { PackageSearch, Clock, CheckCircle2, AlertCircle, RefreshCw, Search, ChevronDown, ChevronUp, PackageCheck, Download, Truck, Home, Hash, Calendar } from 'lucide-react';

dayjs.locale('id');
const PAGE_SIZE = 30;
const JAM_BATAS = 15;
const ICONS: Record<string, string> = { tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚' };

interface OrderRow {
  id: string; desty_order_id: string; order_sn: string; platform: string; platform_name: string;
  store_name: string; order_status: string; customer_name: string; shipping_city: string;
  shipping_address: string; total_price: number; cod_order: boolean;
  order_create_time: string; delivery_deadline: string|null; items: ItemRow[];
}
interface ItemRow { id: string; order_id: string; item_name: string; quantity: number; tracking_number: string|null; courier: string|null; }

interface DeadlineStore { platform: string; total: number; today: number; late: number; lateGudang: number; }

export default function ShippingBoard() {
  const [destyCounts, setDestyCounts] = useState<any>(null);
  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [scannedResisAll, setScannedResisAll] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest'|'oldest'|'price'|'customer'|'store'|'deadline'>('deadline');
  const [expandedOrder, setExpandedOrder] = useState<string|null>(null);
  const [page, setPage] = useState(0);
  const todayStart = dayjs().startOf('day'); const now = dayjs();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dc } = await supabase.from('desty_counts').select('*').eq('id', 1).maybeSingle();
      if (dc) setDestyCounts(dc);
      const ssAll = new Set<string>();
      // Query scans matching order tracking numbers
      const tns = new Set<string>();
      const { data: allTns } = await supabase.from('order_items').select('tracking_number').not('tracking_number','is',null);
      (allTns||[]).forEach((i:any)=>{if(i.tracking_number)tns.add(i.tracking_number.trim().toUpperCase());});
      // Batch query: check which tracking numbers have KELUAR scans
      const tnArray = [...tns];
      for (let i=0; i<tnArray.length; i+=100) {
        const batch = tnArray.slice(i, i+100);
        const { data: matched } = await supabase.from('scans').select('resi').eq('status','KELUAR').in('resi', batch);
        (matched||[]).forEach((s:any)=>{if(s.resi)ssAll.add(s.resi.trim().toUpperCase());});
      }
      setScannedResisAll(ssAll);
      let q = supabase.from('orders').select('*').eq('order_status','Processed');
      const { data: orders } = await q.order('order_create_time',{ascending:false});
      if (orders?.length) {
        const oids = orders.map(o=>o.id);
        const { data: items } = await supabase.from('order_items').select('*').in('order_id',oids);
        const ibo: Record<string,ItemRow[]> = {};
        (items||[]).forEach(i=>{if(!ibo[i.order_id])ibo[i.order_id]=[];ibo[i.order_id].push(i);});
        setAllOrders(orders.map(o=>({...o,items:ibo[o.id]||[]})));
      } else setAllOrders([]);
    } catch(e){console.error(e);}
    setLoading(false);
  }, []);

  useEffect(()=>{fetchAll();},[fetchAll]);

  const isClear = (o:OrderRow)=>o.items.map(i=>i.tracking_number?.trim().toUpperCase()).filter((t):t is string=>!!t&&t.length>3).every(t=>scannedResisAll.has(t));

  const getDeadlineStatus = (o:OrderRow):'today'|'late'|'future'|'none' => {
    if(!o.delivery_deadline) return 'none';
    const d=dayjs(o.delivery_deadline); if(!d.isValid()) return 'none';
    if(d.isBefore(now)) return 'late';
    if(d.isSame(todayStart,'day')) return 'today';
    return 'future';
  };
  const isLateGudang = (o:OrderRow):boolean => {
    const st=getDeadlineStatus(o);
    if(st==='late') return true;
    if(st==='today'&&now.hour()>=JAM_BATAS&&!isClear(o)) return true;
    return false;
  };

  const totalAll = allOrders.length;
  const wajibHariIni = allOrders.filter(o=>getDeadlineStatus(o)==='today');
  const totalWajib = wajibHariIni.length;
  const clearWajib = wajibHariIni.filter(o=>isClear(o)).length;
  const belumWajib = totalWajib - clearWajib;
  const latePlatform = allOrders.filter(o=>getDeadlineStatus(o)==='late').length;
  const lateGudang = allOrders.filter(o=>isLateGudang(o)).length;

  const deadlineStores = useMemo(()=>{
    const m: Record<string,DeadlineStore>= {};
    allOrders.forEach(o=>{const s=o.store_name||'?';if(!m[s])m[s]={platform:o.platform,total:0,today:0,late:0,lateGudang:0};
      m[s].total++;const st=getDeadlineStatus(o);if(st==='today')m[s].today++;if(st==='late')m[s].late++;if(isLateGudang(o))m[s].lateGudang++;});
    return Object.entries(m).sort((a,b)=>(b[1].today+b[1].late)-(a[1].today+a[1].late));
  },[allOrders]);

  const filtered = useMemo(()=>{
    let f=[...allOrders];
    if(platformFilter!=='all')f=f.filter(o=>o.platform===platformFilter);
    if(storeFilter!=='all')f=f.filter(o=>o.store_name===storeFilter);
    if(searchQuery.trim()){const q=searchQuery.toLowerCase();f=f.filter(o=>(o.customer_name||'').toLowerCase().includes(q)||(o.order_sn||'').toLowerCase().includes(q)||o.items.some(i=>(i.tracking_number||'').toLowerCase().includes(q)));}
    switch(sortBy){case'oldest':f.sort((a,b)=>new Date(a.order_create_time).getTime()-new Date(b.order_create_time).getTime());break;case'price':f.sort((a,b)=>(b.total_price||0)-(a.total_price||0));break;case'customer':f.sort((a,b)=>(a.customer_name||'').localeCompare(b.customer_name||''));break;case'store':f.sort((a,b)=>(a.store_name||'').localeCompare(b.store_name||''));break;case'deadline':f.sort((a,b)=>{const da=a.delivery_deadline?new Date(a.delivery_deadline).getTime():9e99;const db=b.delivery_deadline?new Date(b.delivery_deadline).getTime():9e99;return da-db;});break;default:f.sort((a,b)=>new Date(b.order_create_time).getTime()-new Date(a.order_create_time).getTime());}
    return f;
  },[allOrders,platformFilter,storeFilter,searchQuery,sortBy]);

  const paged=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const platforms=[...new Set(allOrders.map(o=>o.platform))].sort();
  const stores=[...new Set(allOrders.map(o=>o.store_name||'?'))].sort();
  const totalFiltered=filtered.length;

  const exportCSV = ()=>{
    const rows=[['Toko','Platform','Order SN','Customer','Resi','Total','Deadline','Status Scan','Status Deadline']];
    filtered.forEach(o=>{const tn=o.items[0]?.tracking_number||'';const dl=o.delivery_deadline?dayjs(o.delivery_deadline).format('DD/MM/YYYY HH:mm'):'N/A';const st=getDeadlineStatus(o);rows.push([o.store_name,o.platform,o.order_sn,o.customer_name,tn,String(o.total_price),dl,isClear(o)?'Clear':'Belum',st==='late'?'TERLAMBAT':st==='today'?'HARI INI':st==='future'?'Aman':'N/A']);});
    const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`antrian-${dayjs().format('YYYY-MM-DD')}.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
      <div><h1 className="page-title" style={{margin:0}}>📋 Antrian Pengiriman</h1><p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>{now.format('dddd, DD MMMM YYYY HH:mm')} • Synced tiap 5 menit</p></div>
      <div style={{display:'flex',gap:'0.5rem'}}><button onClick={exportCSV} className="btn btn-outline"><Download size={18}/> Export CSV</button><button onClick={fetchAll} className="btn btn-primary"><RefreshCw size={18}/> Sync & Segarkan</button></div>
    </div>

    {/* DESTY COUNT CARDS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
      <CC icon={<PackageSearch size={18}/>} label="Total Order" value={destyCounts?.ready_to_ship??'...'} color="#6366f1" sub="Siap Dikirim"/>
      <CC icon={<PackageCheck size={18}/>} label="Ada Resi" value={destyCounts?.processed??'...'} color="var(--success)" sub="Telah Diproses"/>
      <CC icon={<AlertCircle size={18}/>} label="Belum Ada Resi" value={destyCounts?.to_process??'...'} color="#f59e0b" sub="Perlu Diproses"/>
      <CC icon={<Truck size={18}/>} label="Scan Kurir" value={destyCounts?.in_delivery??'...'} color="#0ea5e9" sub="In Delivery"/>
      <CC icon={<Home size={18}/>} label="Diterima" value={destyCounts?.delivered??'...'} color="#8b5cf6" sub="Delivered"/>
      <CC icon={<Hash size={18}/>} label="Total Shipping" value={destyCounts?.shipping??'...'} color="#64748b" sub="All time"/>
    </div>

    {/* DEADLINE CARDS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
      <CC icon={<Calendar size={18}/>} label="Wajib Kirim Hari Ini" value={totalWajib||'...'} color="#f59e0b" sub={`Deadline ${todayStart.format('DD/MM')}`}/>
      <CC icon={<AlertCircle size={18}/>} label="Terlambat Platform" value={latePlatform||'0'} color="var(--danger)" sub="Lewat deadline marketplace"/>
      <CC icon={<AlertCircle size={18}/>} label="Terlambat Gudang" value={lateGudang||'0'} color="#dc2626" sub={`Blm scan & >${JAM_BATAS}:00`}/>
      <CC icon={<Clock size={18}/>} label="Dibatalkan/Gagal" value={destyCounts?.to_process_delivery_failed??'...'} color="#6b7280" sub="Delivery Failed"/>
    </div>

    {/* PROGRESS SCAN */}
    <div className="card" style={{marginBottom:'1.5rem',padding:'1rem',borderLeft:'4px solid var(--primary)'}}>
      <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:'0.75rem'}}>📊 Progress Scan Staff</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'0.75rem',marginBottom:'0.75rem',textAlign:'center'}}>
        <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'#f59e0b'}}>{totalWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Wajib Hari Ini</div></div>
        <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--primary)'}}>{totalAll}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Keseluruhan</div></div>
        <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--success)'}}>{clearWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>✅ Clear</div></div>
        <div><div style={{fontSize:'1.3rem',fontWeight:800,color:belumWajib>0?'var(--danger)':'var(--text-muted)'}}>{belumWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>⏳ Belum</div></div>
        <div><div style={{fontSize:'1.3rem',fontWeight:800,color:totalWajib>0?(clearWajib===totalWajib?'var(--success)':'var(--primary)'):'var(--text-muted)'}}>{totalWajib>0?Math.round(clearWajib/totalWajib*100):0}%</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Progress</div></div>
      </div>
      {totalWajib>0&&<div style={{height:'12px',background:'#e2e8f0',borderRadius:'6px',overflow:'hidden'}}><div style={{height:'100%',width:`${(clearWajib/totalWajib)*100}%`,background:clearWajib===totalWajib?'var(--success)':'var(--primary)',borderRadius:'6px',transition:'width 0.5s'}}/></div>}
    </div>

    {/* DEADLINE PER TOKO */}
    {deadlineStores.length>0&&<div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}>
      <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:'0.75rem'}}>⏰ Deadline Per Toko</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'0.4rem'}}>
        {deadlineStores.map(([n,d])=><div key={n} style={{padding:'0.5rem 0.6rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.4rem'}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:'0.78rem'}}>{(ICONS[d.platform]||'📦')} {n}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{d.total} order</div></div>
          <div style={{display:'flex',gap:'0.3rem',fontSize:'0.7rem',fontWeight:700}}>
            <span style={{color:'#92400e',background:'#fef3c7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🟡{d.today}</span>
            <span style={{color:'#dc2626',background:'#fef2f2',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🔴{d.late}</span>
            <span style={{color:'#991b1b',background:'#fee2e2',padding:'0.15rem 0.4rem',borderRadius:'4px',fontSize:'0.65rem'}}>⛔{d.lateGudang}</span>
          </div>
        </div>)}
      </div>
    </div>}

    {/* FILTERS */}
    <div className="card" style={{marginBottom:'1rem',display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center'}}>
      <div style={{position:'relative',flex:'1 1 160px'}}><Search size={16} color="var(--text-muted)" style={{position:'absolute',top:'50%',left:'0.6rem',transform:'translateY(-50%)'}}/><input className="input" placeholder="Cari..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}} style={{paddingLeft:'2rem',fontSize:'0.85rem'}}/></div>
      <select className="input" value={platformFilter} onChange={e=>{setPlatformFilter(e.target.value);setPage(0);}} style={{width:'auto',fontSize:'0.85rem'}}><option value="all">Semua Platform</option>{platforms.map(p=><option key={p} value={p}>{ICONS[p]||''} {p}</option>)}</select>
      <select className="input" value={storeFilter} onChange={e=>{setStoreFilter(e.target.value);setPage(0);}} style={{width:'auto',fontSize:'0.85rem'}}><option value="all">Semua Toko</option>{stores.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value as any)} style={{width:'auto',fontSize:'0.85rem'}}><option value="deadline">Deadline ↑</option><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="price">Harga ↓</option><option value="customer">Nama A-Z</option><option value="store">Toko A-Z</option></select>
      <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{totalFiltered} order</span>
    </div>

    {/* TABLE */}
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      {loading?<div style={{textAlign:'center',padding:'3rem'}}><RefreshCw className="animate-spin" size={32} style={{margin:'0 auto 1rem',color:'var(--primary)'}}/><p>Memuat...</p></div>
      :paged.length===0?<div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)'}}>{allOrders.length===0?'Belum ada data. Jalankan SQL: ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ;':'Tidak cocok.'}</div>
      :<div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:'0.8rem',borderCollapse:'collapse'}}>
        <thead><tr style={{background:'#1e293b',color:'white'}}><th style={{padding:'0.5rem',width:'35px'}}>#</th><th style={{padding:'0.5rem',width:'45px'}}></th><th style={{padding:'0.5rem'}}>Customer / Order</th><th style={{padding:'0.5rem',minWidth:'130px'}}>Resi</th><th style={{padding:'0.5rem',width:'90px'}}>Deadline</th><th style={{padding:'0.5rem',textAlign:'right',minWidth:'80px'}}>Total</th><th style={{padding:'0.5rem',width:'30px'}}></th></tr></thead>
        <tbody>{paged.map((o,idx)=>{const cl=isClear(o);const ds=getDeadlineStatus(o);const dl=o.delivery_deadline?dayjs(o.delivery_deadline):null;const dlBg=ds==='late'?'#fef2f2':ds==='today'?'#fef3c7':'white';return <><tr key={o.id} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)} style={{cursor:'pointer',borderBottom:'1px solid var(--border)',background:dlBg}}><td style={{padding:'0.4rem',textAlign:'center',color:'var(--text-muted)',fontSize:'0.7rem'}}>{page*PAGE_SIZE+idx+1}</td><td style={{padding:'0.4rem',textAlign:'center'}}>{cl?<CheckCircle2 size={16} color="#16a34a"/>:<Clock size={16} color="#f59e0b"/>}</td><td style={{padding:'0.4rem'}}><div style={{fontWeight:700,fontSize:'0.8rem'}}>{o.customer_name||'-'}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{(ICONS[o.platform]||'')} {o.store_name} • {o.order_sn}</div></td><td style={{padding:'0.4rem'}}>{o.items[0]?.tracking_number?<span style={{fontWeight:700,color:cl?'#16a34a':'var(--primary)',fontSize:'0.78rem'}}>{o.items[0].tracking_number}</span>:<span style={{color:'#94a3b8'}}>—</span>}</td><td style={{padding:'0.4rem',fontSize:'0.72rem',fontWeight:700}}>{dl?<span style={{color:ds==='late'?'#dc2626':ds==='today'?'#92400e':'#16a34a'}}>{dl.format('DD/MM HH:mm')}</span>:<span style={{color:'#94a3b8'}}>N/A</span>}</td><td style={{padding:'0.4rem',textAlign:'right',fontWeight:700,fontSize:'0.8rem',whiteSpace:'nowrap'}}>Rp {(o.total_price||0).toLocaleString('id-ID')}</td><td style={{padding:'0.4rem',textAlign:'center'}}>{expandedOrder===o.id?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</td></tr>
        {expandedOrder===o.id&&<tr><td colSpan={7} style={{padding:'0.6rem',background:'#f8fafc',borderBottom:'2px solid var(--border)'}}><div style={{fontSize:'0.75rem'}}><div style={{marginBottom:'0.4rem',padding:'0.4rem',background:'#eff6ff',borderRadius:'6px'}}><strong>📍</strong> {o.shipping_address||'—'}<br/><strong>💰</strong> {o.cod_order?'COD':'Non-COD'} • {o.items.length} item • 🏪 {o.store_name}<br/><strong>⏰</strong> Deadline: {dl?dl.format('DD/MM/YYYY HH:mm'):'N/A'} {ds==='late'?'🔴 TERLAMBAT PLATFORM':ds==='today'?(isLateGudang(o)?'🔴 TERLAMBAT GUDANG':'🟡 HARI INI'):'🟢'} {isLateGudang(o)&&ds!=='late'?`(>jam ${JAM_BATAS}:00)`:''}</div>{o.items.map((item,i)=>{const t=(item.tracking_number||'').trim().toUpperCase(),sc=t&&scannedResisAll.has(t);return <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.25rem 0',borderBottom:i<o.items.length-1?'1px solid #e2e8f0':'none'}}><div><div style={{fontWeight:600}}>{item.item_name}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>x{item.quantity} {item.courier||''}</div></div><div style={{fontWeight:700,fontSize:'0.78rem',color:sc?'#16a34a':'var(--primary)'}}>{t?<>{sc?'✅':'⏳'} {t}</>:'—'}</div></div>;})}</div></td></tr>}</>;})}</tbody></table>
        {totalFiltered>PAGE_SIZE&&<div style={{display:'flex',justifyContent:'center',gap:'0.3rem',padding:'0.75rem',borderTop:'1px solid var(--border)'}}><button onClick={()=>setPage(0)} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>««</button><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>«</button><span style={{padding:'0.3rem 0.6rem',fontWeight:700,fontSize:'0.8rem'}}>Hal {page+1}/{Math.ceil(totalFiltered/PAGE_SIZE)}</span><button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE_SIZE>=totalFiltered} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»</button><button onClick={()=>setPage(Math.floor(totalFiltered/PAGE_SIZE))} disabled={(page+1)*PAGE_SIZE>=totalFiltered} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»»</button></div>}
      </div>}
    </div>
  </div>;
}

function CC({icon,label,value,color,sub}:{icon:React.ReactNode;label:string;value:number|string;color:string;sub:string}){
  return <div className="card" style={{padding:'0.7rem',textAlign:'center',borderTop:`3px solid ${color}`}}><div style={{color,marginBottom:'0.2rem'}}>{icon}</div><div style={{fontSize:'1.3rem',fontWeight:800,color}}>{value}</div><div style={{fontSize:'0.65rem',fontWeight:700}}>{label}</div><div style={{fontSize:'0.55rem',color:'var(--text-muted)'}}>{sub}</div></div>;
}
