import { createClient } from "@supabase/supabase-js"

const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL!,

  process.env.SUPABASE_SERVICE_ROLE_KEY!

)

export async function GET(
  req: Request
) {

  try {

    // ========================
    // URL PARAMS
    // ========================
    const {
      searchParams
    } = new URL(req.url)

    const code =
      searchParams.get("code")

    if (!code) {

      return new Response(

        JSON.stringify({

          error:
            "Código não informado"

        }),

        {
          status: 400
        }

      )
    }

    // ========================
    // TOKEN REQUEST
    // ========================
    const body =
      new URLSearchParams({

        client_id:
          process.env
            .NUVEMSHOP_CLIENT_ID!,

        client_secret:
          process.env
            .NUVEMSHOP_CLIENT_SECRET!,

        grant_type:
          "authorization_code",

        code

      })

    // ========================
    // ACCESS TOKEN
    // ========================
    const tokenRes =
      await fetch(

        "https://www.nuvemshop.com.br/apps/authorize/token",

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/x-www-form-urlencoded",

          },

          body:
            body.toString()

        }
      )

    const tokenData =
      await tokenRes.json()

    console.log(
      "🔥 TOKEN RESPONSE:",
      tokenData
    )

    // ========================
    // TOKEN ERROR
    // ========================
    if (

      !tokenRes.ok ||

      !tokenData.access_token

    ) {

      console.error(
        "❌ erro token:",
        tokenData
      )

      return new Response(

        JSON.stringify({

          error:
            "Erro ao obter token",

          details:
            tokenData

        }),

        {
          status: 400
        }

      )
    }

    // ========================
    // TOKEN
    // ========================
    const accessToken =
      tokenData.access_token

    const userId =
      tokenData.user_id

    // ========================
    // STORE REQUEST
    // ========================
    const storeRes =
      await fetch(

        `https://api.nuvemshop.com.br/v1/${userId}/store`,

        {

          method: "GET",

          headers: {

            Authorization:
              `Bearer ${accessToken}`,

            "User-Agent":
              "Phandshop/1.0 (contato@phand.com.br)",

            "Content-Type":
              "application/json"

          }

        }
      )

    const storeData =
      await storeRes.json()

    console.log(
      "🏪 STORE RESPONSE:",
      storeData
    )

    // ========================
    // STORE ERROR
    // ========================
    if (!storeRes.ok) {

      console.error(
        "❌ erro store:",
        storeData
      )

      return new Response(

        JSON.stringify({

          error:
            "Erro ao buscar loja",

          details:
            storeData

        }),

        {
          status: 400
        }

      )
    }

    // ========================
    // SHOP URL
    // ========================
    const shop =

      storeData.url_with_protocol ||

      storeData.domains?.[0] ||

      storeData.original_domain ||

      null

    // ========================
    // STORE ID
    // ========================
    const storeId =
      storeData.id

    // ========================
    // VALIDA SHOP
    // ========================
    if (!shop) {

      return new Response(

        JSON.stringify({

          error:
            "Domínio da loja não encontrado",

          details:
            storeData

        }),

        {
          status: 400
        }

      )
    }

    // ========================
    // UPSERT STORE
    // ========================
    const {
      error
    } = await supabase

      .from("stores")

      .upsert(

        {

          store_id:
            storeId,

          user_id:
            userId,

          shop,

          name:
            storeData.name ||

            "Loja Nuvemshop",

          phone:
            storeData.phone ||

            null,

          status:
            "connected",

          access_token:
            accessToken,

          updated_at:
            new Date()
              .toISOString()

        },

        {

          onConflict:
            "store_id"

        }

      )

    // ========================
    // ERROR SAVE
    // ========================
    if (error) {

      console.error(
        "❌ erro Supabase:",
        error
      )

      return new Response(

        JSON.stringify({

          error:
            "Erro ao salvar loja",

          details:
            error

        }),

        {
          status: 500
        }

      )
    }

    console.log(
      "✅ loja conectada:",
      shop
    )

    // ========================
    // REDIRECT
    // ========================
    return Response.redirect(

      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?connected=1`,

      302

    )

  } catch (error) {

    console.error(
      "💥 erro geral:",
      error
    )

    return new Response(

      JSON.stringify({

        error:
          "Erro interno"

      }),

      {
        status: 500
      }

    )
  }
}