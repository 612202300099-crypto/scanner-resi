/**
 * Import data from production Supabase to local via direct PostgreSQL connection
 * Usage: node scripts/import_data.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ifygohsttchhgxozcwcd',
  password: '082139063266',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
};

async function importData() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Verify tables exist
    const { rows: tables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('📋 Existing tables:', tables.map(t => t.table_name).join(', '));
    
    // Import scans data
    const scansPath = path.join(__dirname, '..', 'db_export', 'scans.json');
    const scans = JSON.parse(fs.readFileSync(scansPath, 'utf-8'));
    console.log(`📥 Loaded ${scans.length} scans from export`);
    
    // Count existing scans
    const { rows: countRows } = await client.query('SELECT COUNT(*) as cnt FROM public.scans');
    const existingCount = parseInt(countRows[0].cnt);
    console.log(`📊 Existing scans in DB: ${existingCount}`);
    
    if (existingCount > 0) {
      console.log('⚠️  Scans already exist, skipping import.');
      return;
    }
    
    // Insert in batches
    const BATCH_SIZE = 200;
    let imported = 0;
    let errors = 0;
    
    for (let i = 0; i < scans.length; i += BATCH_SIZE) {
      const batch = scans.slice(i, i + BATCH_SIZE);
      
      // Build parameterized INSERT
      const values = [];
      const params = [];
      let paramIdx = 1;
      
      for (const row of batch) {
        values.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, NULL, $${paramIdx+6})`);
        params.push(
          row.resi,
          row.status,
          row.scanned_at || new Date().toISOString(),
          row.scanned_date || new Date().toISOString().split('T')[0],
          row.scanned_time || '',
          row.scanned_day || '',
          row.user_name || 'Unknown'
        );
        paramIdx += 7;
      }
      
      const sql = `INSERT INTO public.scans (resi, status, scanned_at, scanned_date, scanned_time, scanned_day, user_id, user_name) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`;
      
      try {
        await client.query(sql, params);
        imported += batch.length;
      } catch (err) {
        console.error(`  Batch ${Math.floor(i/BATCH_SIZE)} error: ${err.message.substring(0, 100)}`);
        errors += batch.length;
      }
      
      const progress = Math.min(i + BATCH_SIZE, scans.length);
      process.stdout.write(`\r  📤 Importing: ${progress}/${scans.length} (${imported} ok, ${errors} err)`);
    }
    
    console.log(`\n✅ Import complete: ${imported} rows imported, ${errors} errors`);
    
    // Verify final count
    const { rows: finalCount } = await client.query('SELECT COUNT(*) as cnt FROM public.scans');
    console.log(`📊 Final scans count: ${finalCount[0].cnt}`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

importData();
