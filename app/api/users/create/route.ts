import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(req: Request) {

  const { name, email, role } = await req.json()

  if (!email || !name) {
    return Response.json({ error: "Dados inválidos" }, { status: 400 })
  }

  // 🔥 cria usuário SEM senha
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true
    })

  if (userError) {
    return Response.json({ error: userError.message }, { status: 400 })
  }

  const userId = userData.user.id

  // 🔥 cria profile
  await supabase.from("profiles").insert({
    id: userId,
    name,
    email,
    role
  })

  // 🔥 gera link de criação de senha
  const { data: linkData } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email,
  options: {
    redirectTo: "https://modapink.phand.com.br/reset-password"
  }
})

  if (linkError) {
    return Response.json({ error: linkError.message }, { status: 400 })
  }

  const link = linkData.properties.action_link

  // 🔥 TEMPLATE PROFISSIONAL
  const html = `
  <div style="background:#f6f7fb;padding:40px 20px;font-family:Arial, sans-serif;">

    <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:12px;padding:30px;">

            <!-- TÍTULO -->
      <h2 style="text-align:center;color:#111827;margin-bottom:10px;">
        Bem-vindo à Moda Pink 🚀
      </h2>

      <!-- TEXTO -->
      <p style="text-align:center;color:#6b7280;font-size:14px;">
        Você foi convidado para acessar o painel.<br/>
        Clique no botão abaixo para criar sua senha.
      </p>

      <!-- BOTÃO -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${link}"
           style="
            background:#E6007E;
            color:white;
            padding:14px 22px;
            border-radius:8px;
            text-decoration:none;
            font-weight:600;
            display:inline-block;
           ">
          Criar minha senha
        </a>
      </div>

      <!-- LINK FALLBACK -->
      <p style="font-size:12px;color:#9ca3af;text-align:center;">
        Se o botão não funcionar, copie e cole o link abaixo:
        <br/><br/>
        <span style="word-break:break-all;">
          ${link}
        </span>
      </p>

      <!-- DIVIDER -->
      <hr style="margin:30px 0;border:none;border-top:1px solid #eee;" />

      <!-- FOOTER -->
      <p style="font-size:12px;color:#9ca3af;text-align:center;">
        Este convite foi enviado por Phand.<br/>
        Se você não solicitou, pode ignorar este e-mail.
      </p>

    </div>

  </div>
  `

  // 🔥 envia email
  await resend.emails.send({
    from: "Moda Pink <no-reply@modapink.phand.com.br>",
    to: email,
    subject: "Crie sua senha",
    html
  })

  return Response.json({ success: true })
}