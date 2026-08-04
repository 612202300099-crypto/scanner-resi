#!/usr/bin/env python3
"""
Desty API Proxy Server — bypasses CORS for frontend
Usage: python scripts/desty_proxy.py
Listens on localhost:8734
"""
import http.server, json, urllib.request, ssl, os, sys
from env_loader import load_local_env

load_local_env()

DESTY_BASE = "https://omni.desty.app/api"
ACCESS_TOKEN = os.environ.get("DESTY_ACCESS_TOKEN", "")
TENANT_ID = os.environ.get("DESTY_TENANT_ID", "")
if not ACCESS_TOKEN or not TENANT_ID:
    print("ERROR: Missing env: DESTY_ACCESS_TOKEN, DESTY_TENANT_ID", file=sys.stderr)
    sys.exit(1)

class Proxy(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_cors()
        self.end_headers()
    
    def do_GET(self):
        self.proxy("GET")
    
    def do_POST(self):
        self.proxy("POST")
    
    def proxy(self, method):
        try:
            path = self.path
            desty_url = f"{DESTY_BASE}{path}"
            
            body = None
            if method == "POST":
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ACCESS_TOKEN}",
                "tenantid": TENANT_ID,
                "locale": "idn",
                "ispending": "true",
            }
            
            req = urllib.request.Request(desty_url, data=body, headers=headers, method=method)
            ctx = ssl.create_default_context()
            with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
    
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

if __name__ == "__main__":
    port = 8734
    print(f"🔌 Desty Proxy running on http://localhost:{port}")
    http.server.HTTPServer(("127.0.0.1", port), Proxy).serve_forever()
