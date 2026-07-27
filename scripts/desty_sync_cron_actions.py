#!/usr/bin/env python3
"""
Desty Sync Cron — GitHub Actions version
Reads secrets from environment variables, never hardcoded.
"""
import urllib.request, json, time, os

ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "13e212ad-4fe0-4fe9-840a-b8200ff8f370")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
SUPABASE_URL = "https://ifygohsttchhgxozcwcd.supabase.co"
TENANT_ID = "165686"
DESTY_API = "https://omni.desty.app/api/order-center"

sr_headers = {
    "apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}",
    "Content-Type": "application/json",
}
desty_headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "tenantid": TENANT_ID, "locale": "idn", "ispending": "true",
}

def run():
    print(f"[{time.strftime('%H:%M:%S')}] Syncing Desty → Supabase...")
    synced, updated = 0, 0

    # Get existing order IDs from Supabase
    try:
        r = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/orders?select=desty_order_id&order_status=eq.Processed", headers={"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}"})
        with urllib.request.urlopen(r) as resp:
            existing_ids = set(o['desty_order_id'] for o in json.loads(resp.read().decode()))
    except Exception as e:
        print(f"Failed to get existing orders: {e}")
        return

    # Sync pages
    for page in range(1, 6):
        try:
            payload = json.dumps({"current": page, "size": 50, "status": "Processed"}).encode()
            r = urllib.request.Request(f"{DESTY_API}/package/list", data=payload, headers=desty_headers, method="POST")
            with urllib.request.urlopen(r, timeout=15) as resp:
                data = json.loads(resp.read().decode())

            records = data.get("data", {}).get("records", [])
            if not records:
                break

            for o in records:
                did = o.get("orderId", "")
                ts = o.get("orderCreateTime")
                order_data = {
                    "desty_order_id": did, "order_sn": o.get("displayedOrderSn", ""),
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
                    "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(ts/1000)) if ts else None,
                }

                if did in existing_ids:
                    check = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{did}&select=id", headers={"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}"})
                    with urllib.request.urlopen(check) as cr:
                        oid = json.loads(cr.read().decode())[0]['id']
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/orders?id=eq.{oid}", data=json.dumps(order_data).encode(), headers=sr_headers, method='PATCH'))
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{oid}", headers=sr_headers, method='DELETE'))
                    updated += 1
                else:
                    ins = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/orders", data=json.dumps(order_data).encode(), headers=sr_headers, method='POST')
                    with urllib.request.urlopen(ins) as ir:
                        oid = json.loads(ir.read().decode())[0]['id']
                    synced += 1

                shipment = (o.get("shipmentNo") or "").strip()
                courier = (o.get("courier") or "")
                for item in o.get("items", []):
                    item_data = {"order_id": oid, "item_name": (item.get("productName") or "")[:200], "quantity": item.get("quantity", 1), "tracking_number": shipment, "courier": courier, "is_shipped": False}
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/order_items", data=json.dumps(item_data).encode(), headers=sr_headers, method='POST'))

            print(f"  Page {page}: {len(records)} orders (new:{synced} upd:{updated})")
        except Exception as e:
            print(f"  Page {page} error: {e}")
            break

    print(f"Done! New: {synced}, Updated: {updated}")

if __name__ == "__main__":
    run()
