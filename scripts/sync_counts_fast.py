#!/usr/bin/env python3
"""Fast sync — counts only (runs in ~2 seconds)"""
import urllib.request, json, time

SUPABASE_URL = "https://zervdttmbpenbujkjcrn.supabase.co"
SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnZkdHRtYnBlbmJ1amtqY3JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgwOTcwOSwiZXhwIjoyMDg5Mzg1NzA5fQ.HNfmKammNVgIG-_Z4gIt-wskc5NufvEqWTpmDFMH-2Q"
ACCESS_TOKEN = "13e212ad-4fe0-4fe9-840a-b8200ff8f370"
sr = {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}", "Content-Type": "application/json", "Prefer": "return=representation"}
desty_h = {"Content-Type":"application/json","Authorization":f"Bearer {ACCESS_TOKEN}","tenantid":"165686","locale":"idn","ispending":"true","Origin":"https://omni.desty.app","User-Agent":"Mozilla/5.0"}

r = urllib.request.Request("https://omni.desty.app/api/order-center/package/status/count", data=json.dumps({}).encode(), headers=desty_h, method="POST")
with urllib.request.urlopen(r, timeout=10) as resp:
    cd = json.loads(resp.read().decode())["data"]

counts = {"id":1,"ready_to_ship":int(cd["readyToShip"]),"processed":int(cd["processed"]),
    "to_process":int(cd["toProcess"]),"in_delivery":int(cd["inDelivery"]),
    "delivered":int(cd["delivered"]),"shipping":int(cd["shipping"]),
    "unpaid":int(cd["unpaid"]),"updated_at":time.strftime('%Y-%m-%dT%H:%M:%S+00:00',time.gmtime())}

urllib.request.urlopen(urllib.request.Request(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1", data=json.dumps(counts).encode(), headers=sr, method="PATCH"))
print(f"✅ Counts: ready={counts['ready_to_ship']} proc={counts['processed']} toProc={counts['to_process']}")
