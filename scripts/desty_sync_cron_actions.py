#!/usr/bin/env python3
"""Desty Sync for GitHub Actions — cloud-based, runs every 2 minutes"""
import urllib.request, json, time, os, sys

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "")
TENANT_ID = os.environ.get("DESTY_TENANT_ID", "165686")
DESTY_API = "https://omni.desty.app/api/order-center"

if not SERVICE_ROLE or not ACCESS_TOKEN:
    print("ERROR: Missing secrets. Set SUPABASE_SERVICE_ROLE and DESTY_ACCESS_TOKEN in GitHub Secrets")
    sys.exit(1)

sr = {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}", "Content-Type": "application/json", "Prefer": "return=representation"}
desty_h = {"Content-Type": "application/json", "Authorization": f"Bearer {ACCESS_TOKEN}", "tenantid": TENANT_ID, "locale": "idn", "ispending": "true", "Origin": "https://omni.desty.app", "User-Agent": "Mozilla/5.0"}

def safe_req(url, data=None, method="GET", timeout=15):
    try:
        r = urllib.request.Request(url, data=data, headers=sr if data else {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}"}, method=method)
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read().decode()
            return json.loads(body) if body.strip() else None
    except: return None

print(f"[{time.strftime('%H:%M:%S')} UTC] Desty Sync (GitHub Actions)")
print(f"  Target: {SUPABASE_URL}")

# === 1. COUNTS FIRST ===
try:
    r = urllib.request.Request(f"{DESTY_API}/package/status/count", data=json.dumps({}).encode(), headers=desty_h, method="POST")
    with urllib.request.urlopen(r, timeout=15) as resp:
        cd = json.loads(resp.read().decode()).get("data", {})
    counts = {"id": 1, "ready_to_ship": int(cd.get("readyToShip", 0)), "processed": int(cd.get("processed", 0)),
              "to_process": int(cd.get("toProcess", 0)), "in_delivery": int(cd.get("inDelivery", 0)),
              "delivered": int(cd.get("delivered", 0)), "shipping": int(cd.get("shipping", 0)),
              "unpaid": int(cd.get("unpaid", 0)), "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
    check = safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1&select=id")
    if check: safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1", data=json.dumps(counts).encode(), method="PATCH")
    else: safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts", data=json.dumps(counts).encode(), method="POST")
    print(f"  ✅ Counts: ready={counts['ready_to_ship']} proc={counts['processed']} toProc={counts['to_process']}")
except Exception as e:
    print(f"  ⚠️ Counts error: {e}")

# === 2. ORDERS ===
synced, updated = 0, 0
existing_ids = set()
result = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=desty_order_id&order_status=eq.Processed")
if result: existing_ids = set(o['desty_order_id'] for o in result)

for page in range(1, 8):
    try:
        payload = json.dumps({"current": page, "size": 50, "status": "Processed"}).encode()
        r = urllib.request.Request(f"{DESTY_API}/package/list", data=payload, headers=desty_h, method="POST")
        with urllib.request.urlopen(r, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        records = data.get("data", {}).get("records", [])
        if not records: break
        for o in records:
            did = o.get("orderId", ""); ts = o.get("orderCreateTime")
            try:
                od = {"desty_order_id": did, "order_sn": o.get("displayedOrderSn", ""),
                    "platform": o.get("platformName", "") or "unknown", "platform_name": o.get("platformName", ""),
                    "store_name": o.get("externalShopName", ""), "order_status": "Processed",
                    "customer_name": (o.get("recipientInfo") or {}).get("name", ""),
                    "shipping_address": ((o.get("recipientInfo") or {}).get("address") or {}).get("fullAddress", ""),
                    "shipping_city": ((o.get("recipientInfo") or {}).get("address") or {}).get("city", ""),
                    "total_price": o.get("totalPrice", 0),
                    "cod_order": o.get("paymentMethod") in ("Cash on delivery", "COD"),
                    "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts/1000)) if ts else None}
                if did in existing_ids:
                    cr = safe_req(f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{urllib.request.quote(did, safe='')}&select=id")
                    if cr and len(cr) > 0:
                        safe_req(f"{SUPABASE_URL}/rest/v1/orders?id=eq.{cr[0]['id']}", data=json.dumps(od).encode(), method="PATCH")
                        safe_req(f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{cr[0]['id']}", method="DELETE"); updated += 1
                        oid = cr[0]['id']
                    else: continue
                else:
                    ir = safe_req(f"{SUPABASE_URL}/rest/v1/orders", data=json.dumps(od).encode(), method="POST")
                    if ir: oid = ir[0]['id'] if isinstance(ir, list) else ir['id']; synced += 1; existing_ids.add(did)
                    else: continue
                shipment = (o.get("shipmentNo") or "").strip()
                for item in o.get("items", []):
                    safe_req(f"{SUPABASE_URL}/rest/v1/order_items", data=json.dumps({"order_id": oid, "item_name": (item.get("productName") or "")[:200], "quantity": item.get("quantity", 1), "tracking_number": shipment, "courier": o.get("courier", ""), "is_shipped": False}).encode(), method="POST")
            except: pass
        print(f"  Page {page}: {len(records)} (new:{synced} upd:{updated})")
    except Exception as e:
        print(f"  Page {page} error: {e}"); break

final = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=count&order_status=eq.Processed")
print(f"✅ Done: {final[0]['count'] if final else '?'} orders (new:{synced} upd:{updated})")
