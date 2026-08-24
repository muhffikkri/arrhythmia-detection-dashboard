import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Variabel lingkungan Supabase (VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY) tidak ditemukan di file .env!");
}

let finalSupabaseUrl = supabaseUrl || "";
if (finalSupabaseUrl.startsWith('/')) {
  finalSupabaseUrl = window.location.origin + finalSupabaseUrl;
}

export const supabase = createClient(
  finalSupabaseUrl,
  supabaseAnonKey || ""
);
