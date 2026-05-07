import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

// =====================================================
// SUPABASE ADMIN
// =====================================================
const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL!,

  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =====================================================
// RESEND
// =====================================================
const resend = new Resend(
  process.env.RESEND_API_KEY!
)

export async function POST(
  req: Request
) {

  try {

    const {
      name,
      email,
      role
    } = await req.json()

    // =====================================================
    // VALIDATION
    // =====================================================
    if (
      !email ||
      !name
    ) {

      return Response.json(
        {
          error:
            "Dados inválidos"
        },
        {
          status: 400
        }
      )
    }

    // =====================================================
    // INVITE USER
    // =====================================================
    const {

      data: inviteData,

      error: inviteError

    } = await supabase.auth.admin
      .inviteUserByEmail(
        email,
        {
          redirectTo:
            "https://modapink.phand.com.br/reset-password"
        }
      )

    if (inviteError) {

      console.error(
        "❌ erro invite:",
        inviteError
      )

      return Response.json(
        {
          error:
            inviteError.message
        },
        {
          status: 400
        }
      )
    }

    // =====================================================
    // USER
    // =====================================================
    const user =
      inviteData.user

    if (!user) {

      return Response.json(
        {
          error:
            "Usuário não criado"
        },
        {
          status: 400
        }
      )
    }

    const userId =
      user.id

    console.log(
      "✅ usuário criado:",
      userId
    )

    // =====================================================
    // PROFILE
    // =====================================================
    const {
      error: profileError
    } = await supabase
      .from("profiles")
      .upsert({

        id: userId,

        name,

        email,

        role
      })

    if (profileError) {

      console.error(
        "❌ erro profile:",
        profileError
      )

      return Response.json(
        {
          error:
            profileError.message
        },
        {
          status: 400
        }
      )
    }

    console.log(
      "✅ profile criada"
    )

    // =====================================================
    // GENERATE INVITE LINK
    // =====================================================
    const {

      data: linkData,

      error: linkError

    } = await supabase.auth.admin
      .generateLink({

        type: "invite",

        email,

        options: {

          redirectTo:
            "https://modapink.phand.com.br/reset-password"
        }
      })

    if (linkError) {

      console.error(
        "❌ erro link:",
        linkError
      )

      return Response.json(
        {
          error:
            linkError.message
        },
        {
          status: 400
        }
      )
    }

    const link =
      linkData.properties
        ?.action_link

    if (!link) {

      return Response.json(
        {
          error:
            "Link não gerado"
        },
        {
          status: 400
        }
      )
    }

    // =====================================================
    // TEMPLATE
    // =====================================================
    const html = `
    <div style="background:#f6f7fb;padding:40px 20px;font-family:Arial,sans-serif;">

      <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;padding:32px;">

        <h2 style="text-align:center;color:#111827;margin-bottom:12px;">
          Bem-vindo à Moda Pink 🚀
        </h2>

        <p style="text-align:center;color:#6b7280;font-size:14px;line-height:1.6;">
          Sua conta foi criada com sucesso.<br/>
          Clique no botão abaixo para criar sua senha e acessar o painel.
        </p>

        <div style="text-align:center;margin:32px 0;">

          <a
            href="${link}"
            style="
              background:#E6007E;
              color:#ffffff;
              padding:14px 24px;
              border-radius:10px;
              text-decoration:none;
              font-weight:600;
              display:inline-block;
            "
          >
            Criar minha senha
          </a>

        </div>

        <p style="font-size:12px;color:#9ca3af;text-align:center;">
          Se o botão não funcionar, copie o link abaixo:
        </p>

        <p style="font-size:12px;color:#6b7280;word-break:break-all;text-align:center;">
          ${link}
        </p>

        <hr style="margin:30px 0;border:none;border-top:1px solid #eee;" />

        <p style="font-size:12px;color:#9ca3af;text-align:center;">
          Este convite foi enviado pela Phand.
        </p>

      </div>

    </div>
    `

    // =====================================================
    // SEND EMAIL
    // =====================================================
    const {
      error: emailError
    } = await resend.emails.send({

      from:
        "Moda Pink <no-reply@modapink.phand.com.br>",

      to: email,

      subject:
        "Crie sua senha",

      html
    })

    if (emailError) {

      console.error(
        "❌ erro email:",
        emailError
      )

      return Response.json(
        {
          error:
            emailError.message
        },
        {
          status: 400
        }
      )
    }

    console.log(
      "✅ email enviado"
    )

    // =====================================================
    // SUCCESS
    // =====================================================
    return Response.json({
      success: true
    })

  } catch (err) {

    console.error(
      "💥 erro create user:",
      err
    )

    return Response.json(
      {
        error:
          "Erro interno"
      },
      {
        status: 500
      }
    )
  }
}