import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isPlaceholderUrl =
  !supabaseUrl ||
  supabaseUrl.includes('mock-url.supabase.co') ||
  supabaseUrl.includes('your_supabase_project_url_here');
const isPlaceholderKey =
  !supabaseAnonKey ||
  supabaseAnonKey === 'mock-anon-key' ||
  supabaseAnonKey.includes('your_supabase_anon_key_here');
export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;
export const supabaseConfigError = isSupabaseConfigured
  ? ''
  : 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment.';

if (!isSupabaseConfigured) {
  console.error(supabaseConfigError);
}

// Create a single supabase client for interacting with your database.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const auth = supabase?.auth ?? null;
export const db = supabase; // Useful alias to substitute some Firestore db passes
export const storage = supabase?.storage ?? null;
