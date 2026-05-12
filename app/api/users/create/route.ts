import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.RESEND_API_KEY
) {
  throw new Error(
    "Variáveis de ambiente ausentes"
  )
}

const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL,

  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(
  process.env.RESEND_API_KEY
)

export async function POST(
  req: Request
) {

  try {

    // =========================
    // BODY
    // =========================
    const {

      name,

      email,

      role

    } = await req.json()

    // =========================
    // VALIDATION
    // =========================
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

    // =========================
    // CHECK USER
    // =========================
    const {

      data: existingUser

    } = await supabase

      .from("profiles")

      .select("id")

      .eq(
        "email",
        email
      )

      .maybeSingle()

    if (existingUser) {

      return Response.json(
        {
          error:
            "Usuário já existe"
        },
        {
          status: 400
        }
      )
    }

    // =========================
    // CREATE AUTH USER
    // =========================
    const {

      data: userData,

      error: userError

    } = await supabase

      .auth.admin.createUser({

        email,

        email_confirm: true
      })

    if (userError) {

      return Response.json(
        {
          error:
            userError.message
        },
        {
          status: 400
        }
      )
    }

    const userId =
      userData.user.id

    // =========================
    // CREATE PROFILE
    // =========================
    const {

      error: profileError

    } = await supabase

      .from("profiles")

      .insert({

        id: userId,

        name,

        email,

        role
      })

    // =========================
    // ROLLBACK
    // =========================
    if (profileError) {

      await supabase
        .auth.admin
        .deleteUser(userId)

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

    // =========================
    // GENERATE LINK
    // =========================
    const {

      data: linkData,

      error: linkError

    } = await supabase

      .auth.admin.generateLink({

        type: "recovery",

        email,

        options: {

          redirectTo:

            "https://modapink.phand.com.br/reset-password"
        }
      })

    if (linkError) {

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
        .action_link

    // =========================
    // EMAIL TEMPLATE
    // =========================
    const html = `

    <div style="background:#f6f7fb;padding:40px 20px;font-family:Arial,sans-serif;">

      <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(0,0,0,0.05);">

        <h2 style="text-align:center;color:#111827;margin-bottom:10px;font-size:24px;">
          Bem-vindo à Moda Pink 🚀
        </h2>

        <p style="text-align:center;color:#6b7280;font-size:14px;line-height:1.6;">
          Você foi convidado para acessar o painel da plataforma.
          <br/>
          Clique no botão abaixo para criar sua senha.
        </p>

        <div style="text-align:center;margin:32px 0;">

          <a
            href="${link}"

            style="
              background:#E6007E;
              color:white;
              padding:14px 22px;
              border-radius:10px;
              text-decoration:none;
              font-weight:600;
              display:inline-block;
            "
          >

            Criar minha senha

          </a>

        </div>

        <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">

          Se o botão não funcionar,
          copie e cole o link abaixo:

          <br/><br/>

          <span style="word-break:break-all;">

            ${link}

          </span>

        </p>

        <hr style="margin:30px 0;border:none;border-top:1px solid #eee;" />

        <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">

          Este convite foi enviado por Phand.

          <br/>

          Se você não solicitou,
          apenas ignore este e-mail.

        </p>

      </div>

    </div>
    `

    // =========================
    // SEND EMAIL
    // =========================
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

    // =========================
    // SUCCESS
    // =========================
    return Response.json({
      success: true
    })

  } catch (err: any) {

    console.error(
      "💥 erro create user:",
      err
    )

    return Response.json(
      {
        error:
          "Erro interno do servidor"
      },
      {
        status: 500
      }
    )
  }
}