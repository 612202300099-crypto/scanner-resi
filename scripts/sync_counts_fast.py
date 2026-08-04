#!/usr/bin/env python3
"""Fast sync — counts only (runs in ~2 seconds)"""
import urllib.request, json, time, os, sys
from env_loader import load_local_env

load_local_env()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "")
TENANT_ID = os.environ.get("DESTY_TENANT_ID", "")

missing = [k for k, v in {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE": SERVICE_ROLE,
    "DESTY_ACCESS_TOKEN": ACCESS_TOKEN,
    "DESTY_TENANT_ID": TENANT_ID,
}.items() if not v]
if missing:
    print("ERROR: Missing env: " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)

sr = {"apikey": SERVICE_ROLE, "Authorization": f"Bearer {SERVICE_ROLE}", "Content-Type": "application/json", "Prefer": "return=representation"}
desty_h = {"Content-Type": "application/json", "Authorization": f"Bearer {ACCESS_TOKEN}", "tenantid": TENANT_ID, "locale": "idn", "ispending": "true", "Origin": "https://omni.desty.app", "User-Agent": "Mozilla/5.0"}

r = urllib.request.Request("https://omni.desty.app/api/order-center/package/status/count", data=json.dumps({}).encode(), headers=desty_h, method="POST")
with urllib.request.urlopen(r, timeout=10) as resp:
    cd = json.loads(resp.read().decode())["data"]

counts = {"id":1,"ready_to_ship":int(cd["readyToShip"]),"processed":int(cd["processed"]),
    "to_process":int(cd["toProcess"]),"in_delivery":int(cd["inDelivery"]),
    "delivered":int(cd["delivered"]),"shipping":int(cd["shipping"]),
    "unpaid":int(cd["unpaid"]), "to_process_delivery_failed": int(cd.get("toProcessDeliveryFailed", 0)),
    "updated_at":time.strftime('%Y-%m-%dT%H:%M:%S+00:00',time.gmtime())}

urllib.request.urlopen(urllib.request.Request(f"{SUPABASE_URL}/rest/v1/desty_counts?id=eq.1", data=json.dumps(counts).encode(), headers=sr, method="PATCH"))
print(f"✅ Counts: ready={counts['ready_to_ship']} proc={counts['processed']} toProc={counts['to_process']}")
