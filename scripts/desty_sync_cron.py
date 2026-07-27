
import urllib.request, json, time, os

SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeWdvaHN0dGNoaGd4b3pjd2NkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk0NjU4OSwiZXhwIjoyMTAwNTIyNTg5fQ.L0wSZdxLS_xRYx9u5IcPG6OjzBp3Pug8CBNaiVqDRuo"
SUPABASE_URL = "https://ifygohsttchhgxozcwcd.supabase.co"
ACCESS_TOKEN = "13e212ad-4fe0-4fe9-840a-b8200ff8f370"

desty_headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {ACCESS_TOKEN}",
    "tenantid": "165686", "locale": "idn", "ispending": "true",
    "Origin": "https://omni.desty.app",
}

sr_headers = {
    'apikey': SERVICE_ROLE,
    'Authorization': f'Bearer {SERVICE_ROLE}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}

# Fetch latest orders (only page 1, the most recent)
try:
    payload = json.dumps({"current": 1, "size": 50, "status": "Processed"}).encode()
    req = urllib.request.Request("https://omni.desty.app/api/order-center/package/list",
        data=payload, headers=desty_headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        records = data.get("data", {}).get("records", [])
    
    synced = 0
    for o in records:
        try:
            # Check if order exists
            lookup = f"{SUPABASE_URL}/rest/v1/orders?desty_order_id=eq.{o.get('orderId')}&select=id"
            lookup_req = urllib.request.Request(lookup, headers={'apikey': SERVICE_ROLE, 'Authorization': f'Bearer {SERVICE_ROLE}'})
            with urllib.request.urlopen(lookup_req) as lr:
                existing = json.loads(lr.read().decode())
            
            if existing:
                order_id = existing[0]['id']
                # Update status
                patch = f"{SUPABASE_URL}/rest/v1/orders?id=eq.{order_id}"
                patch_data = {
                    "order_status": o.get("status", "Unknown"),
                    "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                }
                urllib.request.urlopen(urllib.request.Request(patch,
                    data=json.dumps(patch_data).encode(), headers=sr_headers, method='PATCH'))
                
                # Sync tracking numbers
                shipment_no = o.get("shipmentNo", "")
                if shipment_no:
                    # Update order_items tracking
                    items_url = f"{SUPABASE_URL}/rest/v1/order_items?order_id=eq.{order_id}"
                    items_data = {"tracking_number": shipment_no, "courier": o.get("courier", ""), "is_shipped": True}
                    urllib.request.urlopen(urllib.request.Request(items_url,
                        data=json.dumps(items_data).encode(), headers=sr_headers, method='PATCH'))
                
                synced += 1
            else:
                # New order - insert
                order_data = {
                    "desty_order_id": o.get("orderId", ""),
                    "order_sn": o.get("displayedOrderSn", ""),
                    "platform": o.get("platformName", "unknown"),
                    "platform_name": o.get("platformName", ""),
                    "store_name": o.get("externalShopName", ""),
                    "order_status": o.get("status", "Unknown"),
                    "customer_name": o.get("recipientInfo", {}).get("name", ""),
                    "shipping_address": o.get("recipientInfo", {}).get("address", {}).get("fullAddress", ""),
                    "shipping_city": o.get("recipientInfo", {}).get("address", {}).get("city", ""),
                    "shipping_province": o.get("recipientInfo", {}).get("address", {}).get("province", ""),
                    "total_price": o.get("totalPrice", 0),
                    "cod_order": o.get("paymentMethod", "") == "Cash on delivery",
                    "order_create_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(o.get("orderCreateTime", 0)/1000)) if o.get("orderCreateTime") else None,
                }
                
                ins_headers = dict(sr_headers)
                ins_headers['Prefer'] = 'return=representation'
                ins_req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/orders",
                    data=json.dumps(order_data).encode(), headers=ins_headers, method='POST')
                with urllib.request.urlopen(ins_req) as ir:
                    result = json.loads(ir.read().decode())
                    new_id = result[0]["id"] if isinstance(result, list) else result["id"]
                
                # Insert items
                for item in o.get("items", []):
                    item_data = {
                        "order_id": new_id,
                        "item_name": item.get("productName", "")[:200],
                        "item_code": (item.get("masterSku") or item.get("skuCode", ""))[:50],
                        "quantity": item.get("quantity", 1),
                        "tracking_number": o.get("shipmentNo", ""),
                        "courier": o.get("courier", ""),
                        "is_shipped": bool(o.get("shipmentNo")),
                        "image_url": item.get("mainImageUrl", ""),
                    }
                    urllib.request.urlopen(urllib.request.Request(
                        f"{SUPABASE_URL}/rest/v1/order_items",
                        data=json.dumps(item_data).encode(), headers=sr_headers, method='POST'))
                synced += 1
        except Exception as e:
            pass
    
    # Refresh daily queue
    urllib.request.urlopen(urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/refresh_daily_shipping_queue",
        data=json.dumps({}).encode(),
        headers={'apikey': SERVICE_ROLE, 'Authorization': f'Bearer {SERVICE_ROLE}', 'Content-Type': 'application/json'},
        method='POST'))
    
    # Log
    log_data = {
        "sync_type": "cron",
        "orders_fetched": len(records),
        "orders_created": synced,
        "orders_updated": synced,
        "started_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        "completed_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    urllib.request.urlopen(urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/desty_sync_log",
        data=json.dumps(log_data).encode(), headers=sr_headers, method='POST'))
    
    print(f"Synced {synced} orders out of {len(records)} fetched")

except Exception as e:
    print(f"Sync error: {e}")
