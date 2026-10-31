import { createClient, type SupabaseClient } from "@supabase/supabase-js";
type PublicConfig = { url: string; publishableKey: string };
let configured: PublicConfig | null = null;
let client: SupabaseClient | null = null;
export function configureSupabase(config: PublicConfig) {
  if (configured?.url !== config.url || configured?.publishableKey !== config.publishableKey) client = null;
  configured = config;
}
function config(): PublicConfig {
  return configured ?? { url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" };
}
export function isSupabaseConfigured() {
  const c = config();
  try { return new URL(c.url).protocol === "https:" && c.publishableKey.startsWith("sb_publishable_"); } catch { return false; }
}
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("A conexão com o banco da confecção ainda não foi configurada. Procure a administração.");
  if (!client) { const c = config(); client = createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "modapink-confeccao-auth" } }); }
  return client;
}
