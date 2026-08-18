// ============================================================================
// Supabase configuration & client (JS SDK v2, no build step)
// ----------------------------------------------------------------------------
// 1. Create a free project        -> https://supabase.com/dashboard
// 2. Run supabase-schema.sql in the SQL Editor (tables + RLS + storage bucket).
// 3. Create the "images" storage bucket (public) if the SQL didn't.
// 4. Paste your Project URL + anon public key below.
//    (Settings -> API -> Project URL / Project API keys -> "anon" "public")
// 5. See SETUP.md for the full walkthrough.
//
// NOTE: the anon key is safe to expose publicly. Your data is protected by
//       Row Level Security (RLS): reads are public, writes require a signed-in
//       admin. Do NOT skip running supabase-schema.sql.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// vvvvv  PASTE YOUR OWN VALUES HERE  vvvvv
const SUPABASE_URL = "https://cxiyelozlmwpexrzjdyo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aXllbG96bG13cGV4cnpqZHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NTEwMDUsImV4cCI6MjEwMjAyNzAwNX0.ZnwjOW623FmzvEcq8XFO4EaBVcRfU6-iA-fEMIiDasA";
// ^^^^^  PASTE YOUR OWN VALUES HERE  ^^^^^

// Detect the un-edited placeholders so pages can show a friendly hint.
export const isSupabaseConfigured =
  SUPABASE_URL !== "https://YOUR_PROJECT.supabase.co" &&
  SUPABASE_ANON_KEY !== "YOUR_ANON_PUBLIC_KEY";

// Storage bucket used for uploaded images.
export const BUCKET = "images";

// Single shared client (persists the auth session in localStorage).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
