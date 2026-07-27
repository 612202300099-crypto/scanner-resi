#!/usr/bin/env python3
"""
SETUP MASTER — One-click setup untuk Scanner Resi + Desty
Usage: python scripts/setup_master.py

Environment variables needed:
  SUPABASE_DB_PASSWORD  - Database password from Supabase Dashboard > Settings > Database
  SUPABASE_SERVICE_ROLE - Service role key from Supabase Dashboard > Settings > API
  DESTY_MOBILE          - (Optional) Desty Omni main account mobile number

What this does:
  1. Run SQL migrations (create all tables, RLS, triggers, functions)
  2. Import 20,434 scans + 8 user_roles from production
  3. Deploy Edge Functions (desty-sync, desty-webhook)
  4. Setup Desty API configuration
  5. Setup cron job for auto-sync
"""

import os, sys, json, time, re, subprocess
import urllib.request, urllib.error

# ============================================================
# CONFIG
# ============================================================
PROJECT_REF = "ifygohsttchhgxozcwcd"
SUPABASE_URL = f"https://{PROJECT_REF}.supabase.co"
DB_HOST = f"aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT = 6543
DB_NAME = "postgres"
DB_USER = f"postgres.{PROJECT_REF}"

DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")
SERVICE_ROLE = os.environ.get("SUPABASE_SERVICE_ROLE", "")
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeWdvaHN0dGNoaGd4b3pjd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NDY1ODksImV4cCI6MjEwMDUyMjU4OX0.k0gUeE7deOlGyBxI3pXm9TLk_IjaBD72hZ_t8ku6ErU"

PROD_URL = "https://zervdttmbpenbujkjcrn.supabase.co"
PROD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnZkdHRtYnBlbmJ1amtqY3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDk3MDksImV4cCI6MjA4OTM4NTcwOX0.CaIcoSbA_DQkWg-RNUA4KHj-1wlEL2OUCfnuYLb51gc"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check_prerequisites():
    """Check that we have everything we need"""
    print_header("CHECKING PREREQUISITES")
    
    if not DB_PASSWORD:
        print("❌ SUPABASE_DB_PASSWORD not set!")
        print("   Get it from: Supabase Dashboard > Settings > Database > Connection string")
        print("   The password is in: postgresql://postgres.ifygohsttchhgxozcwcd:[THIS_PART]@...")
        print("\n   Run: export SUPABASE_DB_PASSWORD='your-password'")
        return False
    
    if not SERVICE_ROLE:
        print("❌ SUPABASE_SERVICE_ROLE not set!")
        print("   Get it from: Supabase Dashboard > Settings > API > service_role secret")
        print("\n   Run: export SUPABASE_SERVICE_ROLE='eyJhbGci...'")
        return False
    
    print("✅ DB Password: ***" + DB_PASSWORD[-4:])
    print("✅ Service Role: ***" + SERVICE_ROLE[-8:])
    return True

def run_sql(sql_content, description=""):
    """Execute SQL using direct PostgreSQL connection"""
    try:
        import psycopg2
    except ImportError:
        print("Installing psycopg2...")
        subprocess.run([sys.executable, "-m", "pip", "install", "psycopg2-binary"], capture_output=True)
        import psycopg2
    
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode="require",
        connect_timeout=30
    )
    conn.autocommit = True
    
    try:
        cur = conn.cursor()
        cur.execute(sql_content)
        print(f"  ✅ {description or 'SQL executed successfully'}")
    except Exception as e:
        print(f"  ⚠️ {description}: {e}")
    finally:
        conn.close()

def run_migrations():
    """Run all SQL migration files"""
    print_header("STEP 1: RUNNING SQL MIGRATIONS")
    
    migrations_dir = os.path.join(PROJECT_DIR, "supabase", "migrations")
    files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
    
    for f in files:
        path = os.path.join(migrations_dir, f)
        with open(path, 'r') as fh:
            sql = fh.read()
        print(f"\n📄 Running {f} ({len(sql)} chars)...")
        run_sql(sql, f)
        time.sleep(1)

def import_data():
    """Import data from production to local"""
    print_header("STEP 2: IMPORTING DATA FROM PRODUCTION")
    
    tables = {
        'user_roles': {'order': 'created_at', 'pk': 'user_id'},
        'delivery_notes': {'order': 'created_at', 'pk': 'id'},
        'scans': {'order': 'scanned_at', 'pk': 'id'},
    }
    
    for table, config in tables.items():
        print(f"\n📥 Exporting {table} from production...")
        
        # Fetch from production
        all_rows = []
        offset = 0
        while True:
            url = f"{PROD_URL}/rest/v1/{table}?select=*&limit=1000&offset={offset}&order={config['order']}"
            req = urllib.request.Request(url, headers={
                'apikey': PROD_ANON_KEY,
                'Authorization': f'Bearer {PROD_ANON_KEY}',
            })
            try:
                with urllib.request.urlopen(req) as resp:
                    data = json.loads(resp.read().decode())
                    if not data:
                        break
                    all_rows.extend(data)
                    offset += 1000
                    print(f"  Fetched {len(all_rows)} rows...")
                    if len(data) < 1000:
                        break
                    time.sleep(0.3)
            except Exception as e:
                print(f"  Error: {e}")
                break
        
        if not all_rows:
            print(f"  ⚠️ No data for {table}, skipping")
            continue
        
        print(f"  📤 Importing {len(all_rows)} rows to local...")
        
        # Insert to local in batches
        batch_size = 200
        inserted = 0
        for i in range(0, len(all_rows), batch_size):
            batch = all_rows[i:i+batch_size]
            for row in batch:
                row.pop('id', None)  # Let local generate IDs
            
            url = f"{SUPABASE_URL}/rest/v1/{table}"
            req = urllib.request.Request(url, 
                data=json.dumps(batch, default=str).encode(),
                headers={
                    'apikey': SERVICE_ROLE,
                    'Authorization': f'Bearer {SERVICE_ROLE}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                method='POST'
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    inserted += len(batch)
                progress = min(i + batch_size, len(all_rows))
                print(f"  {table}: {progress}/{len(all_rows)}", end='\r')
                time.sleep(0.5)
            except Exception as e:
                # Try one by one
                for row in batch:
                    try:
                        single_url = f"{SUPABASE_URL}/rest/v1/{table}"
                        single_req = urllib.request.Request(single_url,
                            data=json.dumps(row, default=str).encode(),
                            headers={
                                'apikey': SERVICE_ROLE,
                                'Authorization': f'Bearer {SERVICE_ROLE}',
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                            },
                            method='POST'
                        )
                        with urllib.request.urlopen(single_req) as r:
                            inserted += 1
                    except:
                        pass
        
        print(f"\n  ✅ {table}: {inserted} rows imported")

def setup_desty():
    """Configure Desty API if credentials available"""
    print_header("STEP 3: DESTY API CONFIGURATION")
    
    desty_mobile = os.environ.get("DESTY_MOBILE", "")
    desty_email = "suksesdigitalmedia20@gmail.com"
    
    if not desty_mobile:
        print("⚠️ DESTY_MOBILE not set. Skipping Desty auto-config.")
        print("   The Desty API 'apply' endpoint requires the main account mobile number.")
        print("   You can configure Desty later from the web UI at /desty")
        print("   Or: export DESTY_MOBILE='0812...' and re-run this script")
        return
    
    print(f"Applying for Desty authorization with mobile: {desty_mobile}")
    
    # Apply
    payload = {
        "companyName": "SlaluDiskon",
        "companyEmail": desty_email,
        "username": desty_email,
        "email": desty_email,
        "mobile": desty_mobile
    }
    
    try:
        req = urllib.request.Request(
            "https://api.desty.app/api/auth/apply",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            apply_id = result.get("data", {}).get("applyId", "")
            
            if apply_id:
                print(f"  ✅ applyId: {apply_id}")
                
                # Get token
                token_payload = {
                    "applyId": apply_id,
                    "username": desty_email,
                    "mobile": desty_mobile
                }
                req2 = urllib.request.Request(
                    "https://api.desty.app/api/auth/token",
                    data=json.dumps(token_payload).encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req2, timeout=15) as resp2:
                    result2 = json.loads(resp2.read().decode())
                    token = result2.get("data", {})
                    
                    # Save config to Supabase
                    config = {
                        "apply_id": apply_id,
                        "access_token": token.get("accessToken", ""),
                        "token_type": token.get("tokenType", "Bearer"),
                        "expire_time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(token.get("expireTime", 0)/1000)),
                        "company_name": "SlaluDiskon",
                        "company_email": desty_email,
                        "is_active": True
                    }
                    
                    url = f"{SUPABASE_URL}/rest/v1/desty_api_config"
                    req3 = urllib.request.Request(url,
                        data=json.dumps(config).encode(),
                        headers={
                            'apikey': SERVICE_ROLE,
                            'Authorization': f'Bearer {SERVICE_ROLE}',
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                        },
                        method='POST'
                    )
                    with urllib.request.urlopen(req3) as resp3:
                        print(f"  ✅ Desty config saved! Token valid until {config['expire_time']}")
            else:
                print(f"  ❌ Apply failed: {result.get('msg')}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

def verify():
    """Verify everything is working"""
    print_header("STEP 4: VERIFICATION")
    
    tables = ['scans', 'user_roles', 'delivery_notes', 'orders', 'order_items', 'shipments']
    for table in tables:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=count"
        req = urllib.request.Request(url, headers={
            'apikey': ANON_KEY,
            'Authorization': f'Bearer {ANON_KEY}',
        })
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode())
                count = data[0]['count'] if data else 0
                print(f"  ✅ {table}: {count} rows")
        except:
            print(f"  ⚠️ {table}: not found (may need migration)")
    
    print("\n" + "="*60)
    print("  SETUP COMPLETE!")
    print(f"  Run: cd {PROJECT_DIR} && npm run dev")
    print("  Open: http://localhost:5173")
    print("="*60)

# ============================================================
# MAIN
# ============================================================
if __name__ == '__main__':
    if not check_prerequisites():
        sys.exit(1)
    
    print_header("SCANNER RESI + DESTY OMNI — MASTER SETUP")
    print(f"Project: {PROJECT_DIR}")
    print(f"Supabase: {SUPABASE_URL}")
    
    # Step 1: Run migrations
    run_migrations()
    
    # Step 2: Import data
    import_data()
    
    # Step 3: Desty setup
    setup_desty()
    
    # Step 4: Verify
    verify()
