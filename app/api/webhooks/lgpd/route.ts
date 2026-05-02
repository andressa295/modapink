export async function POST(req: Request) {
  const body = await req.json()

  console.log("LGPD webhook:", body)


  return new Response("ok")
}