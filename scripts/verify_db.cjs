const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ifygohsttchhgxozcwcd',
  password: '082139063266',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
};

async function verify() {
  const client = new Client(DB_CONFIG);
  try {
    await client.connect();
    
    const tables = ['scans', 'user_roles', 'delivery_notes', 'orders', 'order_items', 'shipments', 'desty_api_config', 'desty_sync_log', 'daily_shipping_queue'];
    
    console.log('=== DATABASE VERIFICATION ===\n');
    for (const table of tables) {
      const { rows } = await client.query(`SELECT COUNT(*) as cnt FROM public.${table}`);
      const count = parseInt(rows[0].cnt);
      const icon = count > 0 ? '✅' : '📭';
      console.log(`  ${icon} ${table}: ${count.toLocaleString()} rows`);
    }
    
    // Show sample scans
    const { rows: samples } = await client.query('SELECT resi, status, scanned_date, user_name FROM public.scans ORDER BY scanned_at DESC LIMIT 5');
    console.log('\n=== SAMPLE SCANS ===');
    samples.forEach(s => console.log(`  ${s.scanned_date} | ${s.status} | ${s.resi} | ${s.user_name}`));
    
    console.log('\n✅ VERIFICATION COMPLETE');
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await client.end();
  }
}

verify();
