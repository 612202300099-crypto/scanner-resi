/**
 * ShippingBoard — Antrian Pengiriman
 * Features: count cards, deadline, progress scan, per toko, date filter, clickable details
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
dayjs.locale('id');
import { PackageSearch, PackageCheck, AlertCircle, RefreshCw, Search, ChevronDown, Download, Truck, Home, Ban, Filter, X, Calendar, Clock } from 'lucide-react';

const PAGE_SIZE = 25;
const JAM_BATAS = 15;
const ICONS: Record<string, string> = { tiktok: '🎵', shopee: '🛒', tokopedia: '🦉', lazada: '🛍️', blibli: '📚' };

export default function ShippingBoard() {
  const [destyCounts, setDestyCounts] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string,any[]>>({});
  const [scannedResis, setScannedResis] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(dayjs().format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [deadlineDateFrom, setDeadlineDateFrom] = useState('');
  const [deadlineDateTo, setDeadlineDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<string|null>(null);
  const [page, setPage] = useState(0);
  const [detailPopup, setDetailPopup] = useState<{title:string;orders:any[]}|null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dc } = await supabase.from('desty_counts').select('*').eq('id', 1).maybeSingle();
      if (dc) setDestyCounts(dc);

      // Scanned resis
      const ss = new Set<string>();
      let off = 0;
      while (true) {
        const { data: scans } = await supabase.from('scans').select('resi').eq('status','KELUAR').range(off,off+999);
        if (!scans || scans.length===0) break;
        scans.forEach((s:any)=>{if(s.resi)ss.add(s.resi.trim().toUpperCase());});
        off += 1000;
      }
      setScannedResis(ss);

      // Orders
      let q = supabase.from('orders').select('*').eq('order_status','Processed');
      if (dateFrom) q = q.gte('order_date_wib', dateFrom);
      if (dateTo) q = q.lte('order_date_wib', dateTo);
      if (deadlineDateFrom) q = q.gte('deadline_date', deadlineDateFrom);
      if (deadlineDateTo) q = q.lte('deadline_date', deadlineDateTo);
      const { data: ord } = await q.order('order_create_time',{ascending:false});
      setOrders(ord || []);

      if (ord?.length) {
        const { data: itm } = await supabase.from('order_items').select('*').in('order_id',ord.map(o=>o.id));
        const ibo: Record<string,any[]> = {};
        (itm||[]).forEach((i:any)=>{if(!ibo[i.order_id])ibo[i.order_id]=[];ibo[i.order_id].push(i);});
        setItems(ibo);
      } else setItems({});
    } catch(e){console.error(e);}
    setLoading(false);
  }, [dateFrom, dateTo, deadlineDateFrom, deadlineDateTo]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Helpers
  const today = dayjs().format('YYYY-MM-DD');
  const now = dayjs();
  const isClear = (o:any)=> (items[o.id]||[]).map((i:any)=>(i.tracking_number||'').trim().toUpperCase()).filter((t:string)=>t.length>3).every((t:string)=>scannedResis.has(t));

  const getDeadlineStatus = (o:any):'today'|'late'|'future'|'none' => {
    const dd = o.deadline_date; if(!dd) return 'none';
    if(dd < today) return 'late';
    if(dd === today) return 'today';
    return 'future';
  };

  const isLateGudang = (o:any):boolean => {
    const st = getDeadlineStatus(o);
    if(st==='late') return true;
    if(st==='today' && now.hour() >= JAM_BATAS && !isClear(o)) return true;
    return false;
  };

  // Stats
  const wajibHariIni = orders.filter(o=>getDeadlineStatus(o)==='today');
  const totalWajib = wajibHariIni.length;
  const clearWajib = wajibHariIni.filter(o=>isClear(o)).length;
  const belumWajib = totalWajib - clearWajib;
  const latePlatform = orders.filter(o=>getDeadlineStatus(o)==='late').length;
  const lateGudang = orders.filter(o=>isLateGudang(o)).length;

  // Per Toko deadline
  const deadlineStores = useMemo(()=>{
    const m: Record<string,{platform:string;total:number;today:number;late:number;lateGudang:number;orders:any[]}>= {};
    orders.forEach(o=>{const s=o.store_name||'?';if(!m[s])m[s]={platform:o.platform,total:0,today:0,late:0,lateGudang:0,orders:[]};
      m[s].total++;m[s].orders.push(o);const st=getDeadlineStatus(o);if(st==='today')m[s].today++;if(st==='late')m[s].late++;if(isLateGudang(o))m[s].lateGudang++;});
    return Object.entries(m).sort((a,b)=>(b[1].today+b[1].late)-(a[1].today+a[1].late));
  },[orders,items,scannedResis]);

  // Filters
  const filtered = useMemo(()=>{
    let f = [...orders];
    if(platformFilter!=='all') f=f.filter(o=>o.platform===platformFilter);
    if(storeFilter!=='all') f=f.filter(o=>o.store_name===storeFilter);
    if(searchQuery.trim()){const q=searchQuery.toLowerCase();f=f.filter(o=>(o.customer_name||'').toLowerCase().includes(q)||(o.order_sn||'').toLowerCase().includes(q)||(items[o.id]||[]).some((i:any)=>(i.tracking_number||'').toLowerCase().includes(q)));}
    return f;
  },[orders,items,platformFilter,storeFilter,searchQuery]);

  const paged = filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const platforms = [...new Set(orders.map(o=>o.platform))].sort();
  const stores = [...new Set(orders.map(o=>o.store_name||'?'))].sort();

  const exportCSV = ()=>{
    const rows=[['Toko','Platform','Order SN','Customer','Resi','Total','Tgl Order','Deadline','Status']];
    filtered.forEach(o=>{const tn=(items[o.id]||[])[0]?.tracking_number||'';rows.push([o.store_name,o.platform,o.order_sn,o.customer_name,tn,String(o.total_price),o.order_date_wib||'',o.deadline_date||'',isClear(o)?'Clear':'Belum']);});
    const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='antrian-'+dayjs().format('YYYY-MM-DD')+'.csv';a.click();
  };

  return (
    <div>
      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
        <div><h1 className="page-title" style={{margin:0}}>📋 Antrian Pengiriman</h1><p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>{dayjs().format('dddd, DD MMMM YYYY HH:mm')}</p></div>
        <div style={{display:'flex',gap:'0.5rem'}}><button onClick={exportCSV} className="btn btn-outline"><Download size={18}/> Export</button><button onClick={fetchData} className="btn btn-primary"><RefreshCw size={18}/> Segarkan</button></div>
      </div>

      {/* DESTY COUNT CARDS */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
        <CC icon={<PackageSearch size={18}/>} label="Total Order" value={destyCounts?.ready_to_ship??'...'} color="#6366f1" sub="Siap Dikirim"/>
        <CC icon={<PackageCheck size={18}/>} label="Ada Resi" value={destyCounts?.processed??'...'} color="#16a34a" sub="Telah Diproses"/>
        <CC icon={<AlertCircle size={18}/>} label="Belum Ada Resi" value={destyCounts?.to_process??'...'} color="#f59e0b" sub="Perlu Diproses"/>
        <CC icon={<Truck size={18}/>} label="Scan Kurir" value={destyCounts?.in_delivery??'...'} color="#0ea5e9" sub="In Delivery"/>
        <CC icon={<Home size={18}/>} label="Diterima" value={destyCounts?.delivered??'...'} color="#8b5cf6" sub="Delivered"/>
        <CC icon={<Ban size={18}/>} label="Dibatalkan/Gagal" value={destyCounts?.to_process_delivery_failed??476} color="#6b7280" sub="Delivery Failed"/>
      </div>

      {/* DEADLINE CARDS — clickable */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'0.5rem',marginBottom:'1.5rem'}}>
        <div onClick={()=>setDetailPopup({title:'Wajib Kirim Hari Ini',orders:wajibHariIni})} style={{cursor:'pointer'}}>
          <CC icon={<Calendar size={18}/>} label="Wajib Kirim Hari Ini" value={totalWajib||'...'} color="#f59e0b" sub={`Deadline ${today}`}/>
        </div>
        <div onClick={()=>{const late=orders.filter(o=>getDeadlineStatus(o)==='late');setDetailPopup({title:'Terlambat Platform',orders:late});}} style={{cursor:'pointer'}}>
          <CC icon={<AlertCircle size={18}/>} label="Terlambat Platform" value={latePlatform||'0'} color="#dc2626" sub="Lewat deadline marketplace"/>
        </div>
        <div onClick={()=>{const lg=orders.filter(o=>isLateGudang(o));setDetailPopup({title:'Terlambat Gudang',orders:lg});}} style={{cursor:'pointer'}}>
          <CC icon={<Clock size={18}/>} label="Terlambat Gudang" value={lateGudang||'0'} color="#991b1b" sub={`Blm scan & >${JAM_BATAS}:00`}/>
        </div>
      </div>

      {/* PROGRESS SCAN */}
      <div className="card" style={{marginBottom:'1.5rem',padding:'1rem',borderLeft:'4px solid var(--primary)'}}>
        <div style={{fontWeight:800,fontSize:'0.95rem',marginBottom:'0.75rem'}}>📊 Progress Scan Staff</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:'0.75rem',marginBottom:'0.75rem',textAlign:'center'}}>
          <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'#f59e0b'}}>{totalWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Wajib Hari Ini</div></div>
          <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'var(--primary)'}}>{orders.length}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Keseluruhan</div></div>
          <div><div style={{fontSize:'1.3rem',fontWeight:800,color:'#16a34a'}}>{clearWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>✅ Clear</div></div>
          <div><div style={{fontSize:'1.3rem',fontWeight:800,color:belumWajib>0?'#dc2626':'var(--text-muted)'}}>{belumWajib}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>⏳ Belum</div></div>
          <div><div style={{fontSize:'1.3rem',fontWeight:800,color:totalWajib>0?(clearWajib===totalWajib?'#16a34a':'var(--primary)'):'var(--text-muted)'}}>{totalWajib>0?Math.round(clearWajib/totalWajib*100):0}%</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Progress</div></div>
        </div>
        {totalWajib>0&&<div style={{height:'12px',background:'#e2e8f0',borderRadius:'6px',overflow:'hidden'}}><div style={{height:'100%',width:`${(clearWajib/totalWajib)*100}%`,background:clearWajib===totalWajib?'#16a34a':'var(--primary)',borderRadius:'6px',transition:'width 0.5s'}}/></div>}
      </div>

      {/* DEADLINE PER TOKO */}
      {deadlineStores.length>0&&<div className="card" style={{marginBottom:'1.5rem',padding:'1rem'}}>
        <div style={{fontWeight:800,fontSize:'0.9rem',marginBottom:'0.75rem'}}>⏰ Deadline Per Toko</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'0.4rem'}}>
          {deadlineStores.map(([n,d])=><div key={n} style={{padding:'0.5rem 0.6rem',background:'#f8fafc',borderRadius:'6px',border:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.4rem'}}>
            <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setDetailPopup({title:`${n} — Deadline`,orders:d.orders.filter(o=>getDeadlineStatus(o)!=='none')})}>
              <div style={{fontWeight:700,fontSize:'0.78rem'}}>{(ICONS[d.platform]||'📦')} {n}</div>
              <div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{d.total} order</div>
            </div>
            <div style={{display:'flex',gap:'0.3rem',fontSize:'0.7rem',fontWeight:700}}>
              <span style={{color:'#92400e',background:'#fef3c7',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🟡{d.today}</span>
              <span style={{color:'#dc2626',background:'#fef2f2',padding:'0.15rem 0.4rem',borderRadius:'4px'}}>🔴{d.late}</span>
              <span style={{color:'#991b1b',background:'#fee2e2',padding:'0.15rem 0.4rem',borderRadius:'4px',fontSize:'0.65rem'}}>⛔{d.lateGudang}</span>
            </div>
          </div>)}
        </div>
      </div>}

      {/* DATE FILTER — dual */}
      <div className="card" style={{marginBottom:'1rem',padding:'0.75rem',display:'flex',gap:'0.5rem',alignItems:'center',flexWrap:'wrap'}}>
        <Filter size={18} style={{color:'var(--text-muted)'}}/>
        <span style={{fontSize:'0.7rem',fontWeight:700}}>Tgl Order:</span>
        <input type="date" className="input" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(0);}} style={{width:'auto'}}/>
        <span style={{color:'var(--text-muted)'}}>s/d</span>
        <input type="date" className="input" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(0);}} style={{width:'auto'}}/>
        <span style={{fontSize:'0.7rem',fontWeight:700,marginLeft:'0.5rem'}}>Deadline:</span>
        <input type="date" className="input" value={deadlineDateFrom} onChange={e=>{setDeadlineDateFrom(e.target.value);setPage(0);}} style={{width:'auto'}} placeholder="Dari"/>
        <span style={{color:'var(--text-muted)'}}>s/d</span>
        <input type="date" className="input" value={deadlineDateTo} onChange={e=>{setDeadlineDateTo(e.target.value);setPage(0);}} style={{width:'auto'}} placeholder="Sampai"/>
        {(dateFrom || deadlineDateFrom) && <button onClick={()=>{setDateFrom(dayjs().format('YYYY-MM-DD'));setDateTo(dayjs().format('YYYY-MM-DD'));setDeadlineDateFrom('');setDeadlineDateTo('');}} className="btn btn-sm" style={{fontSize:'0.7rem'}}><X size={12}/> Reset</button>}
        <div style={{position:'relative',flex:'1 1 160px',marginLeft:'auto'}}>
          <Search size={16} color="var(--text-muted)" style={{position:'absolute',top:'50%',left:'0.6rem',transform:'translateY(-50%)'}}/>
          <input className="input" placeholder="Cari customer/resi..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}} style={{paddingLeft:'2rem',fontSize:'0.85rem',width:'100%'}}/>
        </div>
        <select className="input" value={platformFilter} onChange={e=>{setPlatformFilter(e.target.value);setPage(0);}} style={{width:'auto'}}><option value="all">Semua Platform</option>{platforms.map(p=><option key={p} value={p}>{ICONS[p]||''} {p}</option>)}</select>
        <select className="input" value={storeFilter} onChange={e=>{setStoreFilter(e.target.value);setPage(0);}} style={{width:'auto'}}><option value="all">Semua Toko</option>{stores.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <span style={{fontSize:'0.75rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{filtered.length} order</span>
      </div>

      {/* TABLE */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {loading?<div style={{textAlign:'center',padding:'3rem'}}><RefreshCw className="animate-spin" size={32} style={{margin:'0 auto 1rem',color:'var(--primary)'}}/><p>Memuat...</p></div>
        :paged.length===0?<div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)'}}>Tidak ada data. Pastikan SQL migration sudah dijalankan.</div>
        :<div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:'0.8rem',borderCollapse:'collapse'}}>
          <thead><tr style={{background:'#1e293b',color:'white'}}><th style={{padding:'0.5rem',width:'35px'}}>#</th><th style={{padding:'0.5rem'}}>Customer / Order</th><th style={{padding:'0.5rem',minWidth:'130px'}}>Resi</th><th style={{padding:'0.5rem',width:'90px'}}>Deadline</th><th style={{padding:'0.5rem',textAlign:'right',minWidth:'80px'}}>Total</th><th style={{padding:'0.5rem',width:'30px'}}></th></tr></thead>
          <tbody>{paged.map((o,idx)=>{const its=items[o.id]||[];const cl=isClear(o);const ds=getDeadlineStatus(o);const bg=ds==='late'?'#fef2f2':ds==='today'?'#fef3c7':'white';return <><tr key={o.id} onClick={()=>setExpandedOrder(expandedOrder===o.id?null:o.id)} style={{cursor:'pointer',borderBottom:'1px solid var(--border)',background:bg}}><td style={{padding:'0.4rem',textAlign:'center',color:'var(--text-muted)',fontSize:'0.7rem'}}>{page*PAGE_SIZE+idx+1}</td><td style={{padding:'0.4rem'}}><div style={{fontWeight:700,fontSize:'0.8rem'}}>{o.customer_name||'-'}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{(ICONS[o.platform]||'')} {o.store_name} • {o.order_sn}</div></td><td style={{padding:'0.4rem'}}>{its[0]?.tracking_number?<span style={{fontWeight:700,color:cl?'#16a34a':'var(--primary)',fontSize:'0.78rem'}}>{cl?'✅ ':''}{its[0].tracking_number}</span>:<span style={{color:'#94a3b8'}}>—</span>}</td><td style={{padding:'0.4rem',fontSize:'0.72rem',fontWeight:700}}>{o.deadline_date?<span style={{color:ds==='late'?'#dc2626':ds==='today'?'#92400e':'#16a34a'}}>{o.deadline_date} {o.deadline_time||''}</span>:<span style={{color:'#94a3b8'}}>N/A</span>}</td><td style={{padding:'0.4rem',textAlign:'right',fontWeight:700,fontSize:'0.8rem',whiteSpace:'nowrap'}}>Rp {(o.total_price||0).toLocaleString('id-ID')}</td><td style={{padding:'0.4rem',textAlign:'center'}}>{expandedOrder===o.id?<ChevronDown size={14} style={{transform:'rotate(180deg)'}}/>:<ChevronDown size={14} style={{opacity:0.3}}/>}</td></tr>
          {expandedOrder===o.id&&<tr><td colSpan={6} style={{padding:'0.6rem',background:'#f8fafc',borderBottom:'2px solid var(--border)'}}><div style={{fontSize:'0.75rem'}}><div style={{marginBottom:'0.5rem',padding:'0.5rem',background:'#eff6ff',borderRadius:'6px'}}><div><strong>🏪</strong> {o.store_name} • {(ICONS[o.platform]||'')} {o.platform}</div><div><strong>📍</strong> {o.shipping_address||'—'}</div><div><strong>💰</strong> {o.cod_order?'COD':'Non-COD'} • {its.length} item</div><div><strong>📅</strong> Order: {o.order_date_wib||'?'}</div><div><strong>⏰</strong> Deadline: {o.deadline_date||'N/A'} {o.deadline_time||''} {ds==='late'?'🔴 TERLAMBAT':ds==='today'?(isLateGudang(o)?'🔴 TERLAMBAT GUDANG':'🟡 HARI INI'):''}</div></div>{its.map((item:any,i:number)=>{const t=(item.tracking_number||'').trim().toUpperCase(),sc=t&&scannedResis.has(t);return <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'0.25rem 0',borderBottom:i<its.length-1?'1px solid #e2e8f0':'none'}}><div><div style={{fontWeight:600}}>{item.item_name}</div><div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>x{item.quantity} {item.courier||''}</div></div><div style={{fontWeight:700,fontSize:'0.78rem',color:sc?'#16a34a':'var(--primary)'}}>{t?<>{sc?'✅':'⏳'} {t}</>:'—'}</div></div>;})}</div></td></tr>}</>;})}</tbody></table>
        {filtered.length>PAGE_SIZE&&<div style={{display:'flex',justifyContent:'center',gap:'0.3rem',padding:'0.75rem',borderTop:'1px solid var(--border)'}}><button onClick={()=>setPage(0)} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>««</button><button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>«</button><span style={{padding:'0.3rem 0.6rem',fontWeight:700,fontSize:'0.8rem'}}>Hal {page+1}/{Math.ceil(filtered.length/PAGE_SIZE)}</span><button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE_SIZE>=filtered.length} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»</button><button onClick={()=>setPage(Math.floor(filtered.length/PAGE_SIZE))} disabled={(page+1)*PAGE_SIZE>=filtered.length} className="btn btn-outline" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem'}}>»»</button></div>}
        </div>}
      </div>

      {/* DETAIL POPUP */}
      {detailPopup&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setDetailPopup(null)}>
        <div style={{background:'white',borderRadius:'8px',padding:'1.5rem',maxWidth:'800px',width:'90%',maxHeight:'80vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}><h3 style={{margin:0}}>{detailPopup.title} ({detailPopup.orders.length})</h3><button onClick={()=>setDetailPopup(null)} className="btn btn-outline"><X size={18}/></button></div>
          <table style={{width:'100%',fontSize:'0.78rem',borderCollapse:'collapse'}}><thead><tr style={{background:'#f1f5f9'}}><th style={{padding:'0.4rem',textAlign:'left'}}>Order SN</th><th style={{padding:'0.4rem',textAlign:'left'}}>Customer</th><th style={{padding:'0.4rem',textAlign:'left'}}>Toko</th><th style={{padding:'0.4rem',textAlign:'left'}}>Resi</th><th style={{padding:'0.4rem',textAlign:'left'}}>Deadline</th><th style={{padding:'0.4rem',textAlign:'right'}}>Total</th></tr></thead><tbody>{detailPopup.orders.slice(0,200).map((o:any)=>{const its=items[o.id]||[];return <tr key={o.id} style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'0.3rem'}}>{o.order_sn}</td><td style={{padding:'0.3rem'}}>{o.customer_name?.slice(0,20)}</td><td style={{padding:'0.3rem'}}>{o.store_name?.slice(0,15)}</td><td style={{padding:'0.3rem'}}>{its[0]?.tracking_number||'—'}</td><td style={{padding:'0.3rem'}}>{o.deadline_date} {o.deadline_time||''}</td><td style={{padding:'0.3rem',textAlign:'right'}}>Rp {(o.total_price||0).toLocaleString('id-ID')}</td></tr>;})}</tbody></table>
          {detailPopup.orders.length>200&&<p style={{textAlign:'center',color:'var(--text-muted)',marginTop:'0.5rem'}}>Menampilkan 200 dari {detailPopup.orders.length}</p>}
        </div>
      </div>}
    </div>
  );
}

function CC({icon,label,value,color,sub}:{icon:React.ReactNode;label:string;value:number|string;color:string;sub:string}){
  return <div className="card" style={{padding:'0.7rem',textAlign:'center',borderTop:`3px solid ${color}`}}><div style={{color,marginBottom:'0.2rem'}}>{icon}</div><div style={{fontSize:'1.3rem',fontWeight:800,color}}>{value}</div><div style={{fontSize:'0.65rem',fontWeight:700}}>{label}</div><div style={{fontSize:'0.55rem',color:'var(--text-muted)'}}>{sub}</div></div>;
}
