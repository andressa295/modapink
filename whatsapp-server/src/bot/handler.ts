export async function handleMessage(message: any) {
  if (message.fromMe) return
  if (message.from.includes("@g.us")) return

  const text = message.body

  console.log("📩 Mensagem:", text)

  await message.reply("Bot funcionando 👍")
}