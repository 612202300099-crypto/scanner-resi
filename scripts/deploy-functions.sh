#!/bin/bash
# Deploy Edge Functions ke Supabase
# Usage: bash scripts/deploy-functions.sh

echo "=== Deploying Supabase Edge Functions ==="
echo ""
echo "Step 1: Login ke Supabase CLI (buka browser)"
npx supabase login

echo ""
echo "Step 2: Link project"
npx supabase link --project-ref ifygohsttchhgxozcwcd

echo ""
echo "Step 3: Deploy functions"
npx supabase functions deploy desty-sync --no-verify-jwt
npx supabase functions deploy desty-webhook --no-verify-jwt

echo ""
echo "=== Done! ==="
echo "desty-sync:  https://ifygohsttchhgxozcwcd.supabase.co/functions/v1/desty-sync"
echo "desty-webhook: https://ifygohsttchhgxozcwcd.supabase.co/functions/v1/desty-webhook"
