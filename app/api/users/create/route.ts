import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

type UserRole = "admin" | "agent" | "user"

const allowedRoles: UserRole[] = [
  "admin",
  "agent",
  "user"
]

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Variável ausente: ${name}`)
  }

  return value
}

const supabaseUrl =
  requiredEnv("NEXT_PUBLIC_SUPABASE_URL")

const serviceRoleKey =
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY")

const resendApiKey =
  requiredEnv("RESEND_API_KEY")

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const resend = new Resend(resendApiKey)

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  )
}

function getFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL ||
    "Moda Pink <no-reply@modapink.phand.com.br>"
  )
}

function buildInviteEmail({
  name,
  link
}: {
  name: string
  link: string
}) {
  return `
    <div style="background:#f6f7fb;padding:40px 20px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:18px;padding:34px;box-shadow:0 12px 35px rgba(15,23,42,0.08);border:1px solid #f1f1f1;">
        
        <div style="text-align:center;margin-bottom:22px;">
          <div style="display:inline-block;background:#fff0f7;color:#E6007E;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">
            Painel Moda Pink
          </div>
        </div>

        <h2 style="text-align:center;color:#111827;margin:0 0 12px;font-size:25px;line-height:1.25;">
          Bem-vindo(a), ${name} 💗
        </h2>

        <p style="text-align:center;color:#6b7280;font-size:15px;line-height:1.7;margin:0;">
          Você foi convidado(a) para acessar o painel da Moda Pink.
          <br/>
          Clique no botão abaixo para criar sua senha.
        </p>

        <div style="text-align:center;margin:34px 0;">
          <a
            href="${link}"
            style="
              background:#E6007E;
              color:#ffffff;
              padding:15px 24px;
              border-radius:12px;
              text-decoration:none;
              font-weight:700;
              display:inline-block;
              font-size:14px;
              box-shadow:0 10px 22px rgba(230,0,126,0.24);
            "
          >
            Criar minha senha
          </a>
        </div>

        <p style="font-size:13px;color:#6b7280;text-align:center;line-height:1.7;margin:0;">
          Se o botão não funcionar, copie e cole este link no navegador:
        </p>

        <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.7;word-break:break-all;margin:14px 0 0;">
          ${link}
        </p>

        <hr style="margin:32px 0;border:none;border-top:1px solid #eeeeee;" />

        <p style="font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;margin:0;">
          Este convite foi enviado por Phand.
          <br/>
          Caso você não reconheça este convite, apenas ignore este e-mail.
        </p>
      </div>
    </div>
  `
}

export async function POST(req: Request) {
  let createdUserId: string | null = null

  try {
    const body = await req.json()

    const name = String(body.name || "").trim()

    const email = String(body.email || "")
      .trim()
      .toLowerCase()

    const role = String(body.role || "agent") as UserRole

    if (!name || !email) {
      return Response.json(
        {
          error: "Preencha nome e e-mail."
        },
        {
          status: 400
        }
      )
    }

    if (!allowedRoles.includes(role)) {
      return Response.json(
        {
          error: "Cargo inválido."
        },
        {
          status: 400
        }
      )
    }

    const {
      data: existingProfile,
      error: existingProfileError
    } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existingProfileError) {
      console.error(
        "Erro ao verificar profile:",
        existingProfileError
      )

      return Response.json(
        {
          error: existingProfileError.message
        },
        {
          status: 400
        }
      )
    }

    if (existingProfile) {
      return Response.json(
        {
          error: "Usuário já existe."
        },
        {
          status: 400
        }
      )
    }

    const temporaryPassword =
      `${crypto.randomUUID()}Aa1!`

    const {
      data: userData,
      error: userError
    } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    })

    if (userError) {
      console.error(
        "Erro ao criar usuário no Auth:",
        userError
      )

      return Response.json(
        {
          error: `Erro Auth: ${userError.message}`
        },
        {
          status: 400
        }
      )
    }

    const userId = userData.user?.id

    if (!userId) {
      return Response.json(
        {
          error: "Usuário criado, mas o ID não foi retornado."
        },
        {
          status: 500
        }
      )
    }

    createdUserId = userId

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

    if (profileError) {
      console.error(
        "Erro ao criar profile:",
        profileError
      )

      await supabase.auth.admin.deleteUser(userId)

      return Response.json(
        {
          error: `Erro Profile: ${profileError.message}`
        },
        {
          status: 400
        }
      )
    }

    const redirectTo =
      `${getSiteUrl()}/reset-password`

    const {
      data: linkData,
      error: linkError
    } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo
      }
    })

    if (linkError) {
      console.error(
        "Erro ao gerar link:",
        linkError
      )

      await supabase
        .from("profiles")
        .delete()
        .eq("id", userId)

      await supabase.auth.admin.deleteUser(userId)

      return Response.json(
        {
          error: `Erro Link: ${linkError.message}`
        },
        {
          status: 400
        }
      )
    }

    const link =
      linkData.properties?.action_link

    if (!link) {
      await supabase
        .from("profiles")
        .delete()
        .eq("id", userId)

      await supabase.auth.admin.deleteUser(userId)

      return Response.json(
        {
          error: "Não foi possível gerar o link de senha."
        },
        {
          status: 500
        }
      )
    }

    const {
      error: emailError
    } = await resend.emails.send({
      from: getFromEmail(),
      to: email,
      subject: "Crie sua senha de acesso",
      html: buildInviteEmail({
        name,
        link
      })
    })

    if (emailError) {
      console.error(
        "Erro ao enviar e-mail:",
        emailError
      )

      await supabase
        .from("profiles")
        .delete()
        .eq("id", userId)

      await supabase.auth.admin.deleteUser(userId)

      return Response.json(
        {
          error: `Erro E-mail: ${emailError.message}`
        },
        {
          status: 400
        }
      )
    }

    return Response.json({
      success: true,
      message: "Usuário criado e link de senha enviado."
    })
  } catch (err) {
    console.error("💥 erro create user:", err)

    if (createdUserId) {
      await supabase
        .from("profiles")
        .delete()
        .eq("id", createdUserId)

      await supabase.auth.admin.deleteUser(createdUserId)
    }

    return Response.json(
      {
        error: "Erro interno do servidor."
      },
      {
        status: 500
      }
    )
  }
}