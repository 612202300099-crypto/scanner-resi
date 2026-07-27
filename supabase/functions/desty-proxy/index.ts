// desty-proxy: Supabase Edge Function — proxies Desty API calls (bypasses CORS)
// Deploy: supabase functions deploy desty-proxy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DESTY_BASE = "https://omni.desty.app/api";
const ACCESS_TOKEN = "13e212ad-4fe0-4fe9-840a-b8200ff8f370";
const TENANT_ID = "165686";

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/desty-proxy", "");
    const destyUrl = `${DESTY_BASE}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "tenantid": TENANT_ID,
      "locale": "idn",
      "ispending": "true",
    };

    let body: string | undefined;
    if (req.method === "POST") {
      body = await req.text();
    }

    const destyReq = new Request(destyUrl, { method: req.method, headers, body });

    const resp = await fetch(destyReq);
    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
