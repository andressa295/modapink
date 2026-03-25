import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const code = searchParams.get("code")

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Código não informado" }),
        { status: 400 }
      )
    }

    // 🔥 1. TROCA CODE POR ACCESS TOKEN (CORRETO)
    const tokenRes = await fetch(
      "https://www.nuvemshop.com.br/apps/authorize/token",
      {
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
      }
    )

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Erro ao obter token:", tokenData)

      return new Response(
        JSON.stringify({ error: "Erro ao obter token" }),
        { status: 400 }
      )
    }

    const accessToken = tokenData.access_token

    // 🔥 2. BUSCA DADOS DA LOJA (OFICIAL)
    const storeRes = await fetch(
      "https://api.nuvemshop.com.br/v1/store",
      {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "Phandshop (contato@phand.com.br)",
        },
      }
    )

    const storeData = await storeRes.json()

    if (!storeRes.ok) {
      console.error("Erro ao buscar loja:", storeData)

      return new Response(
        JSON.stringify({ error: "Erro ao buscar dados da loja" }),
        { status: 400 }
      )
    }

    const shop = storeData.domain
    const storeId = storeData.id

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Domínio da loja não encontrado" }),
        { status: 400 }
      )
    }

    // 💾 3. SALVA NO SUPABASE
    const { error } = await supabase.from("stores").upsert({
      store_id: storeId,
      shop,
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Erro ao salvar no Supabase:", error)

      return new Response(
        JSON.stringify({ error: "Erro ao salvar loja" }),
        { status: 500 }
      )
    }

    // 🔥 4. REDIRECIONA (UX PROFISSIONAL)
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=1`,
      302
    )

  } catch (error) {
    console.error("Erro geral:", error)

    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500 }
    )
  }
}