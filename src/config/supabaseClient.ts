import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn("Variabel lingkungan Supabase (VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY) tidak ditemukan di file .env! Menggunakan mode fallback REST API SQLite.");
}

const finalSupabaseUrl = supabaseUrl || "https://placeholder-project.supabase.co";
const finalAnonKey = supabaseAnonKey || "placeholder-anon-key";

let resolvedSupabaseUrl = finalSupabaseUrl;
if (resolvedSupabaseUrl.startsWith('/')) {
  resolvedSupabaseUrl = window.location.origin + resolvedSupabaseUrl;
}

export const supabase = createClient(
  resolvedSupabaseUrl,
  finalAnonKey
);
