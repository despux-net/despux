import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rromxmhmadwtshughttz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyb214bWhtYWR3dHNodWdodHR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjU3NzksImV4cCI6MjA4MTMwMTc3OX0.KqHi7jvLswRTxp6ivahcIpFswzuotQRHdEsnu09cz5k';

export const supabase = createClient(supabaseUrl, supabaseKey);
