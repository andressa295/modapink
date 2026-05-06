import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Pegamos as variáveis sem o "!"
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se não houver URL (comum no build), passamos um placeholder
  // para o compilador não travar. No runtime, ele usará os valores reais.
  return createBrowserClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder'
  )
}