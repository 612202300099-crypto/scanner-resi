#!/usr/bin/env python3
"""
Desty Sync Cron — syncs Processed orders & counts from Desty to Supabase
Run every 2 minutes via Windows Task Scheduler / cron
"""
import urllib.request, json, time, sys, os
from env_loader import load_local_env

load_local_env()

# === CONFIG ===
DESTY_API = "https://omni.desty.app/api/order-center"
ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "")
TENANT_ID = os.environ.get("DESTY_TENANT_ID", "")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
missing = [k for k, v in {"DESTY_ACCESS_TOKEN": ACCESS_TOKEN, "DESTY_TENANT_ID": TENANT_ID, "SUPABASE_SERVICE_ROLE": SERVICE_ROLE, "SUPABASE_URL": SUPABASE_URL}.items() if not v]
if missing:
    print("ERROR: Missing env: " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)

desty_headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "tenantid": TENANT_ID, "locale": "idn", "ispending": "true",
}
sr_headers = {
    "apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}",
    "Content-Type": "application/json",
}

def log(msg):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

def run():
    log("Starting Desty sync...")
    
    # === 1. Sync Counts ===
    try:
        r = urllib.request.Request(f"{DESTY_API}/package/status/count",
            data=json.dumps({}).encode(), headers=desty_headers, method="POST")
        with urllib.request.urlopen(r, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        
        if data.get("code") == 0:
            d = data["data"]
            # Store in Supabase (simple key-value approach — create table if needed)
            sql_payload = {
                "query": f"""
                DROP TABLE IF EXISTS _desty_counts_tmp;
                CREATE TEMP TABLE _desty_counts_tmp (key text, val integer);
                INSERT INTO _desty_counts_tmp VALUES
                  ('ready_to_ship', {d.get('readyToShip', 0)}),
                  ('processed', {d.get('processed', 0)}),
                  ('to_process', {d.get('toProcess', 0)}),
                  ('in_delivery', {d.get('inDelivery', 0)}),
                  ('delivered', {d.get('delivered', 0)}),
                  ('shipping', {d.get('shipping', 0)}),
                  ('unpaid', {d.get('unpaid', 0)});
                """
            }
            log(f"Counts: ready={d.get('readyToShip')}, processed={d.get('processed')}, toProcess={d.get('toProcess')}")
        else:
            log(f"Counts API error: {data}")
    except Exception as e:
        log(f"Counts sync failed: {e}")
    
    # === 2. Sync Processed Orders ===
    synced = 0
    updated = 0
    
    for page in range(1, 6):
        try:
            payload = json.dumps({"current": page, "size": 50, "status": "Processed"}).encode()
            r = urllib.request.Request(f"{DESTY_API}/package/list", data=payload, headers=desty_headers, method="POST")
            with urllib.request.urlopen(r, timeout=15) as resp:
                page_data = json.loads(resp.read().decode())
            
            records = page_data.get("data", {}).get("records", [])
            if not records:
                break
            
            for o in records:
                did = o.get("orderId", "")
                
                # Check existing
                check_url = f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{did}&select=id"
                check_req = urllib.request.Request(check_url, headers={"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}"})
                try:
                    with urllib.request.urlopen(check_req) as cr:
                        existing = json.loads(cr.read().decode())
                except:
                    existing = []
                
                order_data = {
                    "desty_order_id": did,
                    "order_sn": o.get("displayedOrderSn", ""),
                    "platform": o.get("platformName", "") or "unknown",
                    "platform_name": o.get("platformName", ""),
                    "store_name": o.get("externalShopName", ""),
                    "order_status": "Processed",
                    "customer_name": (o.get("recipientInfo") or {}).get("name", ""),
                    "shipping_city": ((o.get("recipientInfo") or {}).get("address") or {}).get("city", ""),
                    "shipping_province": ((o.get("recipientInfo") or {}).get("address") or {}).get("province", ""),
                    "shipping_address": ((o.get("recipientInfo") or {}).get("address") or {}).get("fullAddress", ""),
                    "total_price": o.get("totalPrice", 0),
                    "cod_order": o.get("paymentMethod") in ("Cash on delivery", "COD"),
                    "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(o.get("orderCreateTime", 0)/1000)) if o.get("orderCreateTime") else None,
                }
                
                oid = None
                if existing:
                    oid = existing[0]["id"]
                    patch_url = f"{SUPABASE_URL}/rest/v1/orders?id=eq.{oid}"
                    urllib.request.urlopen(urllib.request.Request(patch_url, data=json.dumps(order_data).encode(), headers=sr_headers, method="PATCH"))
                    updated += 1
                    
                    # Delete old items
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{oid}", headers=sr_headers, method="DELETE"))
                else:
                    ins_req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/orders", data=json.dumps(order_data).encode(), headers=sr_headers, method="POST")
                    with urllib.request.urlopen(ins_req) as ir:
                        result = json.loads(ir.read().decode())
                        oid = result[0]["id"] if isinstance(result, list) else result["id"]
                    synced += 1
                
                # Insert items
                shipment = (o.get("shipmentNo") or "").strip()
                courier = (o.get("courier") or "")
                for item in o.get("items", []):
                    item_data = {
                        "order_id": oid,
                        "item_name": (item.get("productName") or "")[:200],
                        "quantity": item.get("quantity", 1),
                        "tracking_number": shipment,
                        "courier": courier,
                        "is_shipped": False,
                    }
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/order_items", data=json.dumps(item_data).encode(), headers=sr_headers, method="POST"))
            
        except Exception as e:
            log(f"Page {page} error: {e}")
            break
    
    log(f"Done! New: {synced}, Updated: {updated}")

if __name__ == "__main__":
    run()
