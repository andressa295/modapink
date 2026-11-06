"use client";
import { configureSupabase } from "../lib/supabase-client";
export function SupabaseConfiguration({ url, publishableKey, children }: { url: string; publishableKey: string; children: React.ReactNode }) {
  if (typeof window !== "undefined") configureSupabase({ url, publishableKey });
  return children;
}
