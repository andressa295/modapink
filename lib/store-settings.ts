export type BotTexts = {
  catalog_message: string
  wholesale_message: string
  payment_message: string
  shipping_message: string
  pickup_message: string
  physical_store_message: string
  exchange_message: string
  refund_message: string
  restock_message: string
  after_sales_message: string
  human_support_message: string
  abandoned_cart_message: string
  order_approved_message: string
  review_message: string
}

export type StoreSettings = {
  store_name: string
  company_cnpj: string
  site_url: string
  catalog_url: string
  minimum_order: number
  polyester_price: number
  pix_discount_percent: number
  sac_url: string
  instagram_url: string
  group_url: string
  telegram_url: string
  sac_hours: string
  ships_nationwide: boolean
  separation_business_days: number
  has_physical_store: boolean
  pickup_enabled: boolean
  pickup_location: string
  pickup_address: string
  pickup_hours: string
  motoboy_enabled: boolean
  motoboy_same_day_cutoff: string
  excursion_enabled: boolean
  excursion_phone: string
  excursion_fee: number
  business_hours_message: string
  bot_texts: BotTexts
  updated_from?: string
  updated_at?: string
}

export const DEFAULT_BOT_TEXTS: BotTexts = {
  catalog_message:
    "Claro, amiga 💗\n\nO catálogo completo fica aqui:\n{{catalog_url}}\n\nVocê pode comprar por lá ou me mandar os modelos que gostou que eu te ajudo.",
  wholesale_message:
    "Trabalhamos com atacado sim, amiga 💗\n\nO pedido mínimo é {{minimum_order_formatted}}.\n\nNão precisa de CNPJ e enviamos para todo o Brasil.",
  payment_message:
    "Aceitamos Pix, cartão de crédito e cartão de débito 💗\n\nNo Pix, o desconto atual é de {{pix_discount_percent}}%.",
  shipping_message:
    "Enviamos para todo o Brasil 💗\n\nA separação leva até {{separation_business_days}} dias úteis após o pagamento aprovado. Depois disso, soma o prazo do envio escolhido no checkout.",
  pickup_message:
    "Tem retirada sim, amiga 💗\n\nEndereço:\n{{pickup_address}}\n\nHorário:\n{{pickup_hours}}\n\nA retirada só é liberada quando o pedido estiver separado e com o código de retirada.",
  physical_store_message:
    "Não temos loja física aberta ao público 💗\n\nAs compras são feitas online, mas temos retirada de pedidos finalizados e liberados.",
  exchange_message:
    "Para troca ou devolução, chama nosso SAC por aqui:\n{{sac_url}}\n\nA equipe confere o pedido e te orienta certinho 💗",
  refund_message:
    "Sobre reembolso ou estorno, chama nosso SAC com o número do pedido:\n{{sac_url}} 💗",
  restock_message:
    "Ainda não temos uma data certinha para essa reposição, amiga 💗\n\nAs novidades aparecem no site e no Grupo VIP:\n{{site_url}}\n{{group_url}}",
  after_sales_message:
    "Poxa, amiga, sinto muito por isso 💗\n\nPara resolver esse problema com o pedido, chama nosso SAC:\n{{sac_url}}",
  human_support_message:
    "Claro, amiga 💗 Vou pausar o atendimento automático para uma pessoa da equipe continuar por aqui.",
  abandoned_cart_message:
    "Oi, amiga 💗 Vi que você deixou algumas peças no carrinho. Se quiser finalizar, é só acessar novamente o checkout.",
  order_approved_message:
    "Pagamento aprovado, amiga 💗 Agora seu pedido entrou em separação, que leva até {{separation_business_days}} dias úteis.",
  review_message:
    "Oi, amiga 💗 Seu pedido já chegou? Se puder, deixa uma avaliação pra gente. Isso ajuda muito a Moda Pink."
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: "Moda Pink",
  company_cnpj: "43.548.258/0001-30",
  site_url: "https://atacadomodapink.com.br",
  catalog_url: "https://modapink.phand.com.br",
  minimum_order: 250,
  polyester_price: 12,
  pix_discount_percent: 10,
  sac_url: "https://wa.me/message/4ZUOJB45GHLXN1",
  instagram_url: "https://instagram.com/modapinkatacadooficial",
  group_url: "https://chat.whatsapp.com/KrNe5zpBRSDL9ckr8y10j6",
  telegram_url: "https://t.me/+yGyQd6sSZkgzNTZh",
  sac_hours:
    "Segunda a quinta: das 7h às 14h30\nSexta e sábado: das 7h às 12h30",
  ships_nationwide: true,
  separation_business_days: 2,
  has_physical_store: false,
  pickup_enabled: true,
  pickup_location: "Guarulhos/SP",
  pickup_address:
    "R. Sebastião Walter Fusco, 423 - Cidade Soinco, Guarulhos/SP",
  pickup_hours:
    "Segunda a quinta: das 7h às 14h30\nSexta e sábado: das 7h às 12h30",
  motoboy_enabled: true,
  motoboy_same_day_cutoff: "10:00",
  excursion_enabled: true,
  excursion_phone: "5511978286117",
  excursion_fee: 10,
  business_hours_message:
    "O site funciona 24 horas, amiga 💗\n\nNão temos loja física aberta ao público.\n\nHorário de retirada na sede e atendimento do SAC:\n• Segunda a quinta: das 7h às 14h30\n• Sexta e sábado: das 7h às 12h30",
  bot_texts: DEFAULT_BOT_TEXTS
}

const NUMBER_FIELDS = new Set<keyof StoreSettings>([
  "minimum_order",
  "polyester_price",
  "pix_discount_percent",
  "separation_business_days",
  "excursion_fee"
])

const BOOLEAN_FIELDS = new Set<keyof StoreSettings>([
  "ships_nationwide",
  "has_physical_store",
  "pickup_enabled",
  "motoboy_enabled",
  "excursion_enabled"
])

const STRING_FIELDS = new Set<keyof StoreSettings>([
  "store_name",
  "company_cnpj",
  "site_url",
  "catalog_url",
  "sac_url",
  "instagram_url",
  "group_url",
  "telegram_url",
  "sac_hours",
  "pickup_location",
  "pickup_address",
  "pickup_hours",
  "motoboy_same_day_cutoff",
  "excursion_phone",
  "business_hours_message"
])

function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function normalizeStoreSettings(value: unknown): StoreSettings {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {}

  const normalized: StoreSettings = {
    ...DEFAULT_STORE_SETTINGS,
    bot_texts: {
      ...DEFAULT_BOT_TEXTS,
      ...(
        raw.bot_texts && typeof raw.bot_texts === "object"
          ? raw.bot_texts as Partial<BotTexts>
          : {}
      )
    }
  }

  for (const field of STRING_FIELDS) {
    if (typeof raw[field] === "string") {
      ;(normalized[field] as string) = String(raw[field]).trim()
    }
  }

  for (const field of NUMBER_FIELDS) {
    ;(normalized[field] as number) = finiteNumber(
      raw[field],
      normalized[field] as number
    )
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof raw[field] === "boolean") {
      ;(normalized[field] as boolean) = raw[field]
    }
  }

  if (typeof raw.updated_from === "string") {
    normalized.updated_from = raw.updated_from
  }

  if (typeof raw.updated_at === "string") {
    normalized.updated_at = raw.updated_at
  }

  return normalized
}

export function sanitizeStoreSettingsPatch(value: unknown) {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {}
  const patch: Partial<StoreSettings> = {}

  for (const field of STRING_FIELDS) {
    if (typeof raw[field] === "string") {
      ;(patch[field] as string) = String(raw[field]).trim()
    }
  }

  for (const field of NUMBER_FIELDS) {
    if (raw[field] !== undefined) {
      const parsed = Number(raw[field])
      if (Number.isFinite(parsed) && parsed >= 0) {
        ;(patch[field] as number) = parsed
      }
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (typeof raw[field] === "boolean") {
      ;(patch[field] as boolean) = raw[field]
    }
  }

  if (raw.bot_texts && typeof raw.bot_texts === "object") {
    const botTexts: Partial<BotTexts> = {}

    for (const key of Object.keys(DEFAULT_BOT_TEXTS) as Array<keyof BotTexts>) {
      const text = (raw.bot_texts as Record<string, unknown>)[key]
      if (typeof text === "string") botTexts[key] = text.trim()
    }

    patch.bot_texts = {
      ...DEFAULT_BOT_TEXTS,
      ...botTexts
    }
  }

  return patch
}
