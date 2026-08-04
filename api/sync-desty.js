export const config = { maxDuration: 60 };

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DESTY_BASE = 'https://omni.desty.app/api/order-center';
const PAGE_SIZE = 50;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wibDate(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function wibTime(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) + 7 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}

function isoWib(ms) {
  if (!ms) return null;
  const d = new Date(Number(ms) + 7 * 3600 * 1000);
  return `${d.toISOString().slice(0, 19)}+07:00`;
}

async function readJson(resp) {
  const text = await resp.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function destyFetch(path, body, env) {
  const resp = await fetch(`${DESTY_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${env.DESTY_ACCESS_TOKEN}`,
      tenantid: env.DESTY_TENANT_ID || '165686',
      locale: 'idn',
      ispending: 'true',
      Origin: 'https://omni.desty.app',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify(body || {}),
  });
  const data = await readJson(resp);
  if (!resp.ok || data?.code !== 0) {
    throw new Error(`Desty ${path} failed: HTTP ${resp.status} ${JSON.stringify(data)?.slice(0, 300)}`);
  }
  return data.data || {};
}

async function supabaseFetch(path, options, env) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method: options?.method || 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      ...JSON_HEADERS,
      ...(options?.prefer ? { Prefer: options.prefer } : {}),
      ...(options?.headers || {}),
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await readJson(resp);
  if (!resp.ok) {
    throw new Error(`Supabase ${options?.method || 'GET'} ${path} failed: HTTP ${resp.status} ${JSON.stringify(data)?.slice(0, 300)}`);
  }
  return data;
}

function normalizeOrder(record) {
  const shipmentNo = String(record.shipmentNo || '').trim();
  const orderCreateTime = Number(record.orderCreateTime || 0);
  const deadline = Number(record.deliveryDeadline || 0);
  return {
    desty_order_id: String(record.orderId || ''),
    order_sn: String(record.displayedOrderSn || ''),
    platform: String(record.platformName || 'unknown'),
    platform_name: String(record.platformName || ''),
    store_name: String(record.externalShopName || ''),
    order_status: String(record.status || ''),
    customer_name: String(record.recipientInfo?.name || ''),
    shipping_city: String(record.recipientInfo?.address?.city || ''),
    shipping_province: String(record.recipientInfo?.address?.province || ''),
    shipping_address: String(record.recipientInfo?.address?.fullAddress || ''),
    total_price: Number(record.totalPrice || 0),
    cod_order: ['Cash on delivery', 'COD'].includes(String(record.paymentMethod || '')),
    order_create_time: isoWib(orderCreateTime),
    delivery_deadline: isoWib(deadline),
    order_date_wib: wibDate(orderCreateTime),
    deadline_date: wibDate(deadline),
    deadline_time: wibTime(deadline),
    updated_at: new Date().toISOString(),
    _shipmentNo: shipmentNo,
    _courier: String(record.courier || ''),
    _items: Array.isArray(record.items) ? record.items : [],
  };
}

async function fetchAllPackages(env) {
  const statuses = ['Processed', 'To_Process'];
  const records = [];
  const totals = {};

  for (const status of statuses) {
    let current = 1;
    let pages = 1;
    do {
      const data = await destyFetch('/package/list', { current, size: PAGE_SIZE, status }, env);
      const pageRecords = Array.isArray(data.records) ? data.records : [];
      if (current === 1) totals[status] = Number(data.total || pageRecords.length || 0);
      records.push(...pageRecords);
      pages = Number(data.pages || 0);
      current += 1;
    } while (pages && current <= pages);
  }

  // Deduplicate by the canonical package key requested by the business rules.
  const byKey = new Map();
  for (const r of records) {
    const key = `${r.platformName || ''}|${r.externalShopId || ''}|${r.externalPackageId || r.id || r.orderId || ''}`;
    if (key.trim()) byKey.set(key, r);
  }
  return { records: [...byKey.values()], totals };
}

async function runSync(env) {
  const startedAt = Date.now();

  const countsData = await destyFetch('/package/status/count', {}, env);
  const counts = {
    id: 1,
    ready_to_ship: Number(countsData.readyToShip || 0),
    processed: Number(countsData.processed || 0),
    to_process: Number(countsData.toProcess || 0),
    in_delivery: Number(countsData.inDelivery || 0),
    delivered: Number(countsData.delivered || 0),
    shipping: Number(countsData.shipping || 0),
    unpaid: Number(countsData.unpaid || 0),
    to_process_delivery_failed: Number(countsData.toProcessDeliveryFailed || 0),
    updated_at: new Date().toISOString(),
  };
  await supabaseFetch('desty_counts?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: counts,
  }, env);

  const { records, totals } = await fetchAllPackages(env);
  const normalized = records.map(normalizeOrder).filter(o => o.desty_order_id);
  const activeDestyIds = new Set(normalized.map(o => o.desty_order_id));

  let upserted = [];
  for (const part of chunk(normalized.map(({ _shipmentNo, _courier, _items, ...row }) => row), 200)) {
    const res = await supabaseFetch('orders?on_conflict=desty_order_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: part,
    }, env);
    if (Array.isArray(res)) upserted.push(...res);
  }

  const idByDesty = new Map(upserted.map(row => [row.desty_order_id, row.id]));
  const orderIds = [...idByDesty.values()].filter(Boolean);
  for (const ids of chunk(orderIds, 80)) {
    await supabaseFetch(`order_items?order_id=in.(${ids.join(',')})`, { method: 'DELETE' }, env);
  }

  const itemRows = [];
  for (const src of normalized) {
    const orderId = idByDesty.get(src.desty_order_id);
    if (!orderId) continue;
    const sourceItems = src._items.length ? src._items : [{ productName: 'Paket', quantity: 1 }];
    for (const item of sourceItems) {
      itemRows.push({
        order_id: orderId,
        item_name: String(item.productName || item.name || 'Paket').slice(0, 200),
        item_code: String(item.sku || item.productSku || item.sellerSku || ''),
        quantity: Number(item.quantity || 1),
        tracking_number: src._shipmentNo,
        courier: src._courier,
        is_shipped: false,
        image_url: String(item.imageUrl || item.mainImage || ''),
      });
    }
  }
  for (const part of chunk(itemRows, 500)) {
    await supabaseFetch('order_items', {
      method: 'POST',
      prefer: 'return=minimal',
      body: part,
    }, env);
  }

  const activeDbRows = await supabaseFetch('orders?select=id,desty_order_id,order_status&order_status=in.(Processed,To_Process)&limit=5000', {}, env) || [];
  const staleRows = activeDbRows.filter(row => !activeDestyIds.has(row.desty_order_id));
  for (const part of chunk(staleRows.map(r => r.id), 200)) {
    if (part.length) {
      await supabaseFetch(`orders?id=in.(${part.join(',')})`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { order_status: 'Not_Found', updated_at: new Date().toISOString() },
      }, env);
    }
  }

  return {
    counts,
    fetched: normalized.length,
    declaredTotals: totals,
    upserted: upserted.length,
    itemRows: itemRows.length,
    staleCleaned: staleRows.length,
    durationMs: Date.now() - startedAt,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
    DESTY_ACCESS_TOKEN: process.env.DESTY_ACCESS_TOKEN,
    DESTY_TENANT_ID: process.env.DESTY_TENANT_ID || '165686',
  };

  const missing = Object.entries(env).filter(([key, value]) => key !== 'DESTY_TENANT_ID' && !value).map(([key]) => key);
  if (missing.length) return json(res, 500, { success: false, error: `Missing server env: ${missing.join(', ')}` });

  try {
    const result = await runSync(env);
    return json(res, 200, { success: true, result });
  } catch (error) {
    console.error(error);
    return json(res, 500, { success: false, error: error?.message || 'Sync failed' });
  }
}
