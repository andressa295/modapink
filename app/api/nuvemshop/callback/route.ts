import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get("code")
  const storeId = searchParams.get("store_id")

  if (!code || !storeId) {
    return new Response("Parâmetros inválidos", { status: 400 })
  }

  // 🔥 troca code por access_token
  const tokenRes = await fetch("https://www.nuvemshop.com.br/apps/authorize/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.NUVEMSHOP_CLIENT_ID,
      client_secret: process.env.NUVEMSHOP_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return new Response("Erro ao obter token", { status: 400 })
  }

  // 💾 salva no banco
  await supabase.from("stores").upsert({
    store_id: storeId,
    access_token: tokenData.access_token,
  })

  return new Response("App instalado com sucesso 🚀")
}