#!/usr/bin/env python3
"""Sync Desty → Production Supabase. Counts first (fast), then orders."""
import urllib.request, json, time

SUPABASE_URL = "https://zervdttmbpenbujkjcrn.supabase.co"
SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnZkdHRtYnBlbmJ1amtqY3JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgwOTcwOSwiZXhwIjoyMDg5Mzg1NzA5fQ.HNfmKammNVgIG-_Z4gIt-wskc5NufvEqWTpmDFMH-2Q"
ACCESS_TOKEN = "13e212ad-4fe0-4fe9-840a-b8200ff8f370"
sr = {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}", "Content-Type": "application/json", "Prefer": "return=representation"}
desty_h = {"Content-Type": "application/json", "Authorization": f"Bearer {ACCESS_TOKEN}", "tenantid": "165686", "locale": "idn", "ispending": "true", "Origin": "https://omni.desty.app", "User-Agent": "Mozilla/5.0"}

def safe_req(url, data=None, method="GET", timeout=15):
    try:
        r = urllib.request.Request(url, data=data, headers=sr if data else {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}"}, method=method)
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read().decode()
            return json.loads(body) if body.strip() else None
    except: return None

print(f"[{time.strftime('%H:%M:%S')}] Desty Sync started")

# === 1. COUNTS FIRST (fast, always runs) ===
try:
    r = urllib.request.Request("https://omni.desty.app/api/order-center/package/status/count", data=json.dumps({}).encode(), headers=desty_h, method="POST")
    with urllib.request.urlopen(r, timeout=10) as resp:
        cd = json.loads(resp.read().decode()).get("data", {})
    counts = {"id": 1, "ready_to_ship": int(cd.get("readyToShip", 0)), "processed": int(cd.get("processed", 0)),
              "to_process": int(cd.get("toProcess", 0)), "in_delivery": int(cd.get("inDelivery", 0)),
              "delivered": int(cd.get("delivered", 0)), "shipping": int(cd.get("shipping", 0)),
              "unpaid": int(cd.get("unpaid", 0)), "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    check = safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1&select=id")
    if check and len(check) > 0:
        safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1", data=json.dumps(counts).encode(), method="PATCH")
    else:
        safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts", data=json.dumps(counts).encode(), method="POST")
    print(f"  📊 Counts: ready={counts['ready_to_ship']} proc={counts['processed']} toProc={counts['to_process']} inDel={counts['in_delivery']}")
except Exception as e:
    print(f"  ⚠️ Counts error: {e}")

# === 2. ORDERS (slower, skip if unchanged) ===
synced, updated, errors = 0, 0, 0
desty_ids = set()
existing_ids = set()
result = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=desty_order_id&order_status=eq.Processed")
if result: existing_ids = set(o['desty_order_id'] for o in result)

for page in range(1, 8):
    try:
        payload = json.dumps({"current": page, "size": 50, "status": "Processed"}).encode()
        r = urllib.request.Request("https://omni.desty.app/api/order-center/package/list", data=payload, headers=desty_h, method="POST")
        with urllib.request.urlopen(r, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        records = data.get("data", {}).get("records", [])
        if not records: break

        for o in records:
            did = o.get("orderId", "")
            if did:
                desty_ids.add(did)
            try:
                ts = o.get("orderCreateTime")
                order_data = {"desty_order_id": did, "order_sn": o.get("displayedOrderSn", ""),
                    "platform": o.get("platformName", "") or "unknown", "platform_name": o.get("platformName", ""),
                    "store_name": o.get("externalShopName", ""),
                    "order_status": "Cancelled" if o.get("requestCancelStatus") == 1 else "Processed",
                    "customer_name": (o.get("recipientInfo") or {}).get("name", ""),
                    "shipping_city": ((o.get("recipientInfo") or {}).get("address") or {}).get("city", ""),
                    "shipping_province": ((o.get("recipientInfo") or {}).get("address") or {}).get("province", ""),
                    "shipping_address": ((o.get("recipientInfo") or {}).get("address") or {}).get("fullAddress", ""),
                    "total_price": o.get("totalPrice", 0),
                    "cod_order": o.get("paymentMethod") in ("Cash on delivery", "COD"),
                    "delivery_deadline": time.strftime('%Y-%m-%dT%H:%M:%S+07:00', time.localtime(dl/1000)) if (dl := o.get("deliveryDeadline")) else None,
                    "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%S+07:00', time.localtime(ts/1000)) if ts else None,
                    "order_date_wib": time.strftime('%Y-%m-%d', time.localtime(ts/1000)) if ts else None,
                    "deadline_date": time.strftime('%Y-%m-%d', time.localtime(dl/1000)) if (dl := o.get("deliveryDeadline")) else None,
                    "deadline_time": time.strftime('%H:%M', time.localtime(dl/1000)) if (dl := o.get("deliveryDeadline")) else None}

                if did in existing_ids:
                    check_res = safe_req(f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{urllib.request.quote(did, safe='')}&select=id")
                    if check_res and len(check_res) > 0:
                        oid = check_res[0]['id']
                        safe_req(f"{SUPABASE_URL}/rest/v1/orders?id=eq.{oid}", data=json.dumps(order_data).encode(), method="PATCH")
                        safe_req(f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{oid}", method="DELETE")
                        updated += 1
                    else:
                        ins_res = safe_req(f"{SUPABASE_URL}/rest/v1/orders", data=json.dumps(order_data).encode(), method="POST")
                        if ins_res:
                            oid = ins_res[0]['id'] if isinstance(ins_res, list) else ins_res['id']
                            synced += 1; existing_ids.add(did)
                        else: errors += 1; continue
                else:
                    ins_res = safe_req(f"{SUPABASE_URL}/rest/v1/orders", data=json.dumps(order_data).encode(), method="POST")
                    if ins_res:
                        oid = ins_res[0]['id'] if isinstance(ins_res, list) else ins_res['id']
                        synced += 1; existing_ids.add(did)
                    else: errors += 1; continue

                shipment = (o.get("shipmentNo") or "").strip()
                courier = (o.get("courier") or "")
                for item in o.get("items", []):
                    item_data = {"order_id": oid, "item_name": (item.get("productName") or "")[:200], "quantity": item.get("quantity", 1), "tracking_number": shipment, "courier": courier, "is_shipped": False}
                    safe_req(f"{SUPABASE_URL}/rest/v1/order_items", data=json.dumps(item_data).encode(), method="POST")
            except: errors += 1
        print(f"  Page {page}: {len(records)} (new:{synced} upd:{updated} err:{errors})")
    except Exception as e:
        print(f"  Page {page} API error: {e}"); break

final = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=count&order_status=eq.Processed")
total = final[0]['count'] if final else 0
print(f"✅ Done! Orders: new={synced} upd={updated} errors={errors}")

# Mark stale orders (no longer in Desty Processed list) as Not_Found
if desty_ids:
    all_our = []
    for off in range(0, 1000, 100):
        r = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=id,desty_order_id&order_status=eq.Processed&limit=100&offset={off}")
        if not r: break
        all_our.extend(r)
    stale = [o for o in all_our if o['desty_order_id'] not in desty_ids]
    for o in stale:
        safe_req(f"{SUPABASE_URL}/rest/v1/orders?id=eq.{o['id']}", method="PATCH", data=json.dumps({"order_status":"Not_Found"}))
    if stale: print(f"⚠️ Marked {len(stale)} stale orders as Not_Found")

# Log
try:
    safe_req(f"{SUPABASE_URL}/rest/v1/desty_sync_log", data=json.dumps({"status": "completed", "new_orders": synced, "updated_orders": updated, "finished_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}).encode(), method="POST")
except: pass
