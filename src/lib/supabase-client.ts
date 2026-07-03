"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client (auth only for now — notes stay in local files).
// The session persists in localStorage, so after one online sign-in the app
// opens fully offline; a failed token refresh with no network does NOT sign
// the user out.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true } },
    );
  }
  return client;
}
