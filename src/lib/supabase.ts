import { createClient } from '@supabase/supabase-js';

// Pastikan env variables terisi, jika tidak kita panggil manual stringnya
// Tetapi sangat disarankan menggunakan .env.local untuk keamanan
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zervdttmbpenbujkjcrn.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnZkdHRtYnBlbmJ1amtqY3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDk3MDksImV4cCI6MjA4OTM4NTcwOX0.CaIcoSbA_DQkWg-RNUA4KHj-1wlEL2OUCfnuYLb51gc';

export const supabase = createClient(supabaseUrl, supabaseKey);
