import { createClient } from '@supabase/supabase-js';

// Pastikan env variables terisi, jika tidak kita panggil manual stringnya
// Tetapi sangat disarankan menggunakan .env.local untuk keamanan
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://euxinsbjfukszxzejbop.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eGluc2JqZnVrc3p4emVqYm9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMTU0ODEsImV4cCI6MjA4MTc5MTQ4MX0.-ROOHd6Ou4XR7_4T_IPZir6b45dFKqfl6an9G37Cnvk';

export const supabase = createClient(supabaseUrl, supabaseKey);
