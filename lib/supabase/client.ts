import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se as variáveis não existirem (comum no build), passamos strings vazias
  // O createBrowserClient não vai crashar o build se receber strings, 
  // apenas se receber 'undefined'.
  return createBrowserClient(
    url ?? "", 
    key ?? ""
  )
}