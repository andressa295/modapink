export async function POST(req: Request) {
  const body = await req.json()

  console.log("LGPD webhook:", body)

  // 👉 depois você implementa lógica real
  // por enquanto só responde OK

  return new Response("ok")
}