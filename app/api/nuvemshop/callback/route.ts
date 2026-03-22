import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const code = searchParams.get("code")
  const shop = searchParams.get("shop")

  if (!code || !shop) {
    return new Response("Parâmetros inválidos", { status: 400 })
  }

  try {
    // 🔥 troca code por access_token
    const tokenRes = await fetch(`https://${shop}/apps/authorize/token`, {
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
      console.error(tokenData)
      return new Response("Erro ao obter token", { status: 400 })
    }

    // 💾 salva no banco
    await supabase.from("stores").upsert({
      shop,
      access_token: tokenData.access_token,
    })

    return new Response("Loja conectada com sucesso 🚀")
  } catch (error) {
    console.error(error)
    return new Response("Erro interno", { status: 500 })
  }
}