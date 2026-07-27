#!/usr/bin/env python3
"""
IMPORT SCRIPT: Copy data dari Production Supabase → Local Supabase
Usage: python scripts/import_prod_to_local.py
"""

import urllib.request
import urllib.error
import json
import os
import sys
import time

# ============================================================
# CONFIG
# ============================================================
PROD_URL = "https://zervdttmbpenbujkjcrn.supabase.co"
PROD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnZkdHRtYnBlbmJ1amtqY3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDk3MDksImV4cCI6MjA4OTM4NTcwOX0.CaIcoSbA_DQkWg-RNUA4KHj-1wlEL2OUCfnuYLb51gc"

LOCAL_URL = "https://ifygohsttchhgxozcwcd.supabase.co"
LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeWdvaHN0dGNoaGd4b3pjd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NDY1ODksImV4cCI6MjEwMDUyMjU4OX0.k0gUeE7deOlGyBxI3pXm9TLk_IjaBD72hZ_t8ku6ErU"

BATCH_SIZE = 500  # Insert batch size

# ============================================================
# HELPERS
# ============================================================

def supabase_request(base_url, anon_key, path, method='GET', data=None):
    """Make a request to Supabase REST API"""
    url = f"{base_url}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': anon_key,
        'Authorization': f'Bearer {anon_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }, method=method)
    
    if data:
        req.data = json.dumps(data).encode()
    
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode()
            return {'success': True, 'data': json.loads(content) if content else []}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {'success': False, 'error': f'{e.code}: {body[:200]}'}


def fetch_all_from_prod(table, order_col='id', limit=1000):
    """Fetch all rows from production table"""
    all_rows = []
    offset = 0
    
    while True:
        path = f"{table}?select=*&limit={limit}&offset={offset}"
        if order_col:
            path += f"&order={order_col}"
        
        result = supabase_request(PROD_URL, PROD_ANON_KEY, path)
        
        if not result['success']:
            print(f"  ❌ Error at offset {offset}: {result['error']}")
            break
        
        rows = result['data']
        if not rows:
            break
        
        all_rows.extend(rows)
        offset += limit
        print(f"  📥 Fetched {len(all_rows)} rows from {table}...")
        
        if len(rows) < limit:
            break
        
        time.sleep(0.3)
    
    return all_rows


def insert_batch_to_local(table, rows, batch_size=BATCH_SIZE):
    """Insert rows into local Supabase in batches"""
    total = len(rows)
    inserted = 0
    failed = 0
    
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        
        # Remove 'id' if present (let local generate new UUIDs)
        for row in batch:
            row.pop('id', None)
        
        result = supabase_request(LOCAL_URL, LOCAL_ANON_KEY, table, method='POST', data=batch)
        
        if result['success']:
            inserted += len(batch)
        else:
            # Try one by one for failed batches
            for row in batch:
                single = supabase_request(LOCAL_URL, LOCAL_ANON_KEY, table, method='POST', data=row)
                if single['success']:
                    inserted += 1
                else:
                    failed += 1
                    if failed <= 3:
                        print(f"  ⚠️ Failed row: {row.get('resi', row.get('user_id', 'unknown'))[:40]} - {single['error']}")
        
        progress = min(i + batch_size, total)
        print(f"  📤 {table}: {progress}/{total} ({inserted} inserted, {failed} failed)")
        time.sleep(0.5)
    
    return inserted, failed


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  DATA MIGRATION: Production → Local Supabase")
    print("=" * 60)
    
    # Step 1: Verify local connection
    print("\n🔍 Checking local Supabase connection...")
    r = supabase_request(LOCAL_URL, LOCAL_ANON_KEY, "scans?select=count")
    if not r['success']:
        print(f"  ❌ Cannot connect to local Supabase: {r['error']}")
        print("\n  ⚠️  Make sure you have run the SQL migration first!")
        print("  Go to: https://ifygohsttchhgxozcwcd.supabase.com → SQL Editor")
        print("  Run: supabase/migrations/00001_initial_schema.sql")
        return
    print("  ✅ Local Supabase connected")
    
    # Step 2: Import delivery_notes (empty but create table awareness)
    print("\n📦 delivery_notes: 0 rows (empty table, skipping)")
    
    # Step 3: Import user_roles
    print("\n📦 Fetching user_roles from production...")
    user_roles = fetch_all_from_prod("user_roles", order_col="created_at")
    print(f"  ✅ {len(user_roles)} user_roles fetched")
    
    print("\n📤 Importing user_roles to local...")
    inserted, failed = insert_batch_to_local("user_roles", user_roles)
    print(f"  ✅ user_roles: {inserted} inserted, {failed} failed")
    
    # Step 4: Import scans (large table)
    print("\n📦 Fetching scans from production... (this may take a while for 20k+ rows)")
    scans = fetch_all_from_prod("scans", order_col="scanned_at")
    print(f"  ✅ {len(scans)} scans fetched")
    
    print("\n📤 Importing scans to local...")
    inserted, failed = insert_batch_to_local("scans", scans, batch_size=200)
    print(f"  ✅ scans: {inserted} inserted, {failed} failed")
    
    # Summary
    print("\n" + "=" * 60)
    print("  IMPORT COMPLETE!")
    print(f"  user_roles: {len(user_roles)} rows")
    print(f"  scans: {len(scans)} rows")
    print(f"  delivery_notes: 0 rows (new table)")
    print("=" * 60)
    
    # Verify
    print("\n🔍 Verifying local data...")
    for table in ['user_roles', 'scans', 'delivery_notes']:
        r = supabase_request(LOCAL_URL, LOCAL_ANON_KEY, f"{table}?select=count")
        if r['success']:
            count = r['data'][0]['count'] if r['data'] else 0
            print(f"  Local {table}: {count} rows")


if __name__ == '__main__':
    main()
