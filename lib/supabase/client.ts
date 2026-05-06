// lib/supabase.ts (ou onde sua função createClient estiver)
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se as variáveis forem undefined (comum no build), usamos um placeholder.
  // No runtime do servidor, ele usará os valores reais configurados.
  return createBrowserClient(
    url || 'https://placeholder-url.supabase.co', 
    key || 'placeholder-key'
  )
}