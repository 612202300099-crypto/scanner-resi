#!/usr/bin/env python3
"""Desty Sync for GitHub Actions — cloud-based, full sync + cleanup"""
import urllib.request, json, time, os, sys

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "")
TENANT_ID = os.environ.get("DESTY_TENANT_ID", "")

if not SERVICE_ROLE or not ACCESS_TOKEN or not SUPABASE_URL or not TENANT_ID:
    print("ERROR: Missing secrets")
    sys.exit(1)

sr = {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}", "Content-Type": "application/json", "Prefer": "return=representation"}
desty_h = {"Content-Type":"application/json","Authorization":f"Bearer {ACCESS_TOKEN}","tenantid":TENANT_ID,"locale":"idn","ispending":"true","Origin":"https://omni.desty.app","User-Agent":"Mozilla/5.0"}

def safe_req(url, data=None, method="GET", timeout=20):
    try:
        r = urllib.request.Request(url, data=data.encode() if isinstance(data, str) else json.dumps(data).encode() if data else None, 
            headers=sr if method in ("PATCH","POST") and data else {"apikey":SERVICE_ROLE,"Authorization":f"Bearer {SERVICE_ROLE}"}, method=method)
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            body = resp.read().decode()
            return json.loads(body) if body.strip() else []
    except: return None

print(f"[{time.strftime('%H:%M:%S')} UTC] Desty Sync")

# 1. COUNTS FIRST (fast)
try:
    r = urllib.request.Request("https://omni.desty.app/api/order-center/package/status/count", 
        data=json.dumps({}).encode(), headers=desty_h, method="POST")
    with urllib.request.urlopen(r, timeout=15) as resp:
        cd = json.loads(resp.read().decode()).get("data", {})
    counts = {"id":1,"ready_to_ship":int(cd.get("readyToShip",0)),"processed":int(cd.get("processed",0)),
        "to_process":int(cd.get("toProcess",0)),"in_delivery":int(cd.get("inDelivery",0)),
        "delivered":int(cd.get("delivered",0)),"shipping":int(cd.get("shipping",0)),
        "unpaid":int(cd.get("unpaid",0)),"to_process_delivery_failed":int(cd.get("toProcessDeliveryFailed",0)),
        "updated_at":time.strftime('%Y-%m-%dT%H:%M:%S+00:00',time.gmtime())}
    check = safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1&select=id")
    if check: safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1", method="PATCH", data=counts)
    else: safe_req(f"{SUPABASE_URL}/rest/v1/desty_counts", method="POST", data=counts)
    print(f"  ✅ Counts: ready={counts['ready_to_ship']}, toProc={counts['to_process']}")
except Exception as e:
    print(f"  ⚠️ Counts error: {e}")

# 2. ORDERS with dates + cleanup
desty_ids = set()
synced, updated = 0, 0
for page in range(1, 8):
    try:
        r = urllib.request.Request("https://omni.desty.app/api/order-center/package/list",
            data=json.dumps({"current":page,"size":50,"status":"Processed"}).encode(), headers=desty_h, method="POST")
        with urllib.request.urlopen(r, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        records = data.get("data",{}).get("records",[])
        if not records: break
        for o in records:
            did = o.get("orderId",""); desty_ids.add(did)
            ts = o.get("orderCreateTime"); dl = o.get("deliveryDeadline")
            od = {
                "desty_order_id": did, "order_sn": o.get("displayedOrderSn",""),
                "platform": o.get("platformName","") or "unknown",
                "store_name": o.get("externalShopName",""),
                "order_status": "Processed",
                "customer_name": (o.get("recipientInfo")or{}).get("name",""),
                "shipping_address": ((o.get("recipientInfo")or{}).get("address")or{}).get("fullAddress",""),
                "total_price": o.get("totalPrice",0),
                "cod_order": o.get("paymentMethod") in ("Cash on delivery","COD"),
                "order_date_wib": time.strftime('%Y-%m-%d',time.localtime(ts/1000)) if ts else None,
                "deadline_date": time.strftime('%Y-%m-%d',time.localtime(dl/1000)) if dl else None,
                "deadline_time": time.strftime('%H:%M',time.localtime(dl/1000)) if dl else None,
                "delivery_deadline": time.strftime('%Y-%m-%dT%H:%M:%S+07:00',time.localtime(dl/1000)) if dl else None,
                "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%S+07:00',time.localtime(ts/1000)) if ts else None,
            }
            # Check existing
            check = safe_req(f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{did}&select=id")
            if check:
                oid = check[0]['id'] if isinstance(check, list) else check['id']
                safe_req(f"{SUPABASE_URL}/rest/v1/orders?id=eq.{oid}", method="PATCH", data=od)
                updated += 1
                # Update items
                shipment = (o.get("shipmentNo") or "").strip()
                courier = o.get("courier","")
                try:
                    urllib.request.Request(f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{oid}", 
                        headers={"apikey":SERVICE_ROLE,"Authorization":f"Bearer {SERVICE_ROLE}"}, method="DELETE")
                    urllib.request.urlopen(urllib.request.Request(f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{oid}", 
                        headers={"apikey":SERVICE_ROLE,"Authorization":f"Bearer {SERVICE_ROLE}"}, method="DELETE"))
                except: pass
                for item in o.get("items",[]):
                    safe_req(f"{SUPABASE_URL}/rest/v1/order_items", method="POST", data={
                        "order_id":oid,"item_name":item.get("productName","")[:200],
                        "quantity":item.get("quantity",1),"tracking_number":shipment,"courier":courier})
            else:
                ir = safe_req(f"{SUPABASE_URL}/rest/v1/orders", method="POST", data=od)
                if ir:
                    oid_new = ir[0]['id'] if isinstance(ir,list) else ir['id']
                    shipment = (o.get("shipmentNo") or "").strip()
                    for item in o.get("items",[]):
                        safe_req(f"{SUPABASE_URL}/rest/v1/order_items", method="POST", data={
                            "order_id":oid_new,"item_name":item.get("productName","")[:200],
                            "quantity":item.get("quantity",1),"tracking_number":shipment,"courier":o.get("courier","")})
                    synced += 1
    except Exception as e:
        print(f"  Page {page} error: {e}"); break
print(f"  📦 Orders: new={synced} upd={updated}")

# 3. CLEANUP stale
# IMPORTANT: collect first, patch later. If we PATCH while paging with offset,
# PostgREST result set shrinks and records get skipped.
all_processed = []
for off in range(0, 5000, 1000):
    batch = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=id,desty_order_id&order_status=eq.Processed&limit=1000&offset={off}")
    if not batch: break
    all_processed.extend(batch)
    if len(batch) < 1000: break
stale_rows = [o for o in all_processed if o.get('desty_order_id') not in desty_ids]
for o in stale_rows:
    safe_req(f"{SUPABASE_URL}/rest/v1/orders?id=eq.{o['id']}", method="PATCH", data={"order_status":"Not_Found"})
if stale_rows: print(f"  🧹 Cleaned {len(stale_rows)} stale → Not_Found")

final = safe_req(f"{SUPABASE_URL}/rest/v1/orders?select=count&order_status=eq.Processed")
print(f"✅ Done: {final[0]['count'] if final else '?'} orders")
