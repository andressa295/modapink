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

    // 🔥 1. TROCA CODE POR ACCESS TOKEN
    const body = new URLSearchParams({
      client_id: process.env.NUVEMSHOP_CLIENT_ID!,
      client_secret: process.env.NUVEMSHOP_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
    })

    const tokenRes = await fetch(
      "https://www.nuvemshop.com.br/apps/authorize/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    )

    const tokenData = await tokenRes.json()

    console.log("TOKEN RESPONSE:", tokenData)

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Erro ao obter token:", tokenData)

      return new Response(
        JSON.stringify({
          error: "Erro ao obter token",
          details: tokenData,
        }),
        { status: 400 }
      )
    }

    const accessToken = tokenData.access_token
    const userId = tokenData.user_id

    // 🔥 2. BUSCA DADOS DA LOJA
    const storeRes = await fetch(
      `https://api.nuvemshop.com.br/v1/${userId}/store`,
      {
        headers: {
          Authentication: `bearer ${accessToken}`,
          "User-Agent": "Phandshop/1.0 (contato@phand.com.br)",
        },
      }
    )

    const storeData = await storeRes.json()

    console.log("STORE RESPONSE:", storeData)

    if (!storeRes.ok) {
      console.error("Erro ao buscar loja:", storeData)

      return new Response(
        JSON.stringify({
          error: "Erro ao buscar dados da loja",
          details: storeData,
        }),
        { status: 400 }
      )
    }

    // 🔥 DOMÍNIO CORRETO (ADAPTADO PRA API REAL)
    const shop =
      storeData.url_with_protocol ||
      storeData.domains?.[0] ||
      storeData.original_domain

    const storeId = storeData.id

    if (!shop) {
      return new Response(
        JSON.stringify({
          error: "Domínio da loja não encontrado",
          details: storeData,
        }),
        { status: 400 }
      )
    }

    // 💾 3. SALVA NO SUPABASE
    const { error } = await supabase.from("stores").upsert({
      store_id: storeId,
      user_id: userId,
      shop,
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error("Erro Supabase:", error)

      return new Response(
        JSON.stringify({ error: "Erro ao salvar loja" }),
        { status: 500 }
      )
    }

    console.log("✅ Loja conectada:", shop)

    // 🔥 4. REDIRECT FINAL
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