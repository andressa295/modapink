"use client"

import {
  useEffect,
  useMemo,
  useState
} from "react"

import Link from "next/link"

import {
  createBrowserClient
} from "@supabase/ssr"

import styles from "./textos-bot.module.css"

const supabase =
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

type BotTexts = {
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

type TextField = {
  key: keyof BotTexts
  title: string
  description: string
  placeholder: string
}

const defaultBotTexts: BotTexts = {
  catalog_message:
    "Claro, amiga 💗\n\nO catálogo completo fica no site:\n{{site_url}}\n\nVocê pode comprar direto por lá ou me mandar aqui os modelos que gostou que eu te ajudo.",

  wholesale_message:
    "Trabalhamos com atacado sim, amiga 💗\n\nO pedido mínimo é R$ {{minimum_order}}.\n\nNão precisa de CNPJ e enviamos para todo o Brasil.\n\nVocê pode ver as peças no site:\n{{site_url}}",

  payment_message:
    "Aceitamos Pix, cartão de crédito e cartão de débito 💗\n\nNo momento, não trabalhamos com boleto.",

  shipping_message:
    "Enviamos para todo o Brasil 💗\n\nAs opções de envio aparecem no checkout conforme o CEP e o pedido montado.\n\nO prazo funciona assim:\n• separação do pedido: até 2 dias úteis após o pagamento aprovado\n• depois disso, soma o prazo da forma de envio escolhida",

  pickup_message:
    "A retirada é feita somente na sede, amiga 💗\n\nEndereço:\n{{pickup_address}}\n\nHorário:\n{{pickup_hours}}\n\nA retirada só é liberada quando o pedido estiver separado e com o código de retirada.",

  physical_store_message:
    "No momento não temos loja física aberta ao público 💗\n\nAs compras podem ser feitas pelo site:\n{{site_url}}\n\nTambém conseguimos ajudar por aqui no WhatsApp.",

  exchange_message:
    "Para troca ou devolução, chama nosso SAC por aqui:\n{{sac_url}}\n\nA equipe vai conferir o pedido e te orientar certinho 💗",

  refund_message:
    "Sobre reembolso ou estorno, precisa chamar nosso SAC:\n{{sac_url}}\n\nA equipe confere o pedido e te passa o status certinho 💗",

  restock_message:
    "Amiga, no momento não temos previsão certinha de reposição 💗\n\nAs novidades e reposições aparecem primeiro no site e no Grupo VIP.\n\nSite:\n{{site_url}}\n\nGrupo VIP:\n{{group_url}}",

  after_sales_message:
    "Poxa, amiga, sinto muito por isso 💗\n\nPara resolver troca, defeito, item errado, reembolso ou problema com pedido, chama nosso SAC:\n{{sac_url}}",

  human_support_message:
    "Claro, amiga 💗\n\nVou pausar o atendimento automático e deixar uma pessoa da equipe continuar por aqui.\n\nPode aguardar um pouquinho, tá?",

  abandoned_cart_message:
    "Oi, amiga 💗\n\nVi que você deixou algumas peças no carrinho.\n\nSe quiser finalizar, é só acessar o link do checkout. Qualquer dúvida, me chama por aqui.",

  order_approved_message:
    "Pagamento aprovado, amiga 💗\n\nAgora seu pedido entrou em separação.\n\nO prazo é de até 2 dias úteis após o pagamento aprovado.",

  review_message:
    "Oi, amiga 💗\n\nSeu pedido já chegou?\n\nSe puder, deixa uma avaliação pra gente. Isso ajuda muito a Moda Pink."
}

const fields: TextField[] = [
  {
    key: "catalog_message",
    title: "Catálogo / site",
    description:
      "Resposta quando a cliente pede catálogo, link do site ou peças disponíveis.",
    placeholder:
      "Texto para catálogo..."
  },
  {
    key: "wholesale_message",
    title: "Atacado / revenda",
    description:
      "Resposta sobre pedido mínimo, CNPJ, revenda e atacado.",
    placeholder:
      "Texto para atacado..."
  },
  {
    key: "payment_message",
    title: "Formas de pagamento",
    description:
      "Resposta sobre Pix, cartão, débito, crédito, boleto e pagamentos.",
    placeholder:
      "Texto para pagamento..."
  },
  {
    key: "shipping_message",
    title: "Envios / frete",
    description:
      "Resposta sobre entrega, PAC, Sedex, transportadora e prazos.",
    placeholder:
      "Texto para envios..."
  },
  {
    key: "pickup_message",
    title: "Retirada",
    description:
      "Resposta sobre retirada na sede, endereço, horário e código de retirada.",
    placeholder:
      "Texto para retirada..."
  },
  {
    key: "physical_store_message",
    title: "Loja física",
    description:
      "Resposta quando perguntam se existe loja física ou atendimento presencial.",
    placeholder:
      "Texto para loja física..."
  },
  {
    key: "exchange_message",
    title: "Trocas e devoluções",
    description:
      "Resposta sobre troca, devolução ou arrependimento.",
    placeholder:
      "Texto para troca..."
  },
  {
    key: "refund_message",
    title: "Reembolso / estorno",
    description:
      "Resposta sobre prazo de reembolso, estorno e dinheiro de volta.",
    placeholder:
      "Texto para reembolso..."
  },
  {
    key: "restock_message",
    title: "Reposição",
    description:
      "Resposta quando perguntam se uma peça, cor ou tamanho vai voltar.",
    placeholder:
      "Texto para reposição..."
  },
  {
    key: "after_sales_message",
    title: "Problemas com pedido",
    description:
      "Resposta sobre defeito, peça errada, item faltando ou reclamação.",
    placeholder:
      "Texto para pós-venda..."
  },
  {
    key: "human_support_message",
    title: "Atendimento humano",
    description:
      "Mensagem enviada quando o bot pausa e transfere para uma pessoa.",
    placeholder:
      "Texto para atendimento humano..."
  },
  {
    key: "abandoned_cart_message",
    title: "Carrinho abandonado",
    description:
      "Mensagem base usada para recuperar carrinho abandonado.",
    placeholder:
      "Texto para carrinho abandonado..."
  },
  {
    key: "order_approved_message",
    title: "Pedido aprovado",
    description:
      "Mensagem enviada após pagamento aprovado.",
    placeholder:
      "Texto para pedido aprovado..."
  },
  {
    key: "review_message",
    title: "Avaliação pós-compra",
    description:
      "Mensagem enviada para pedir avaliação depois da compra.",
    placeholder:
      "Texto para avaliação..."
  }
]

function normalizeBotTexts(value: any): BotTexts {
  return {
    ...defaultBotTexts,
    ...(value || {})
  }
}

export default function TextosBotPage() {
  const [
    botTexts,
    setBotTexts
  ] = useState<BotTexts>(defaultBotTexts)

  const [
    fullSettings,
    setFullSettings
  ] = useState<any>({})

  const [
    activeKey,
    setActiveKey
  ] = useState<keyof BotTexts>("catalog_message")

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    saved,
    setSaved
  ] = useState(false)

  const [
    error,
    setError
  ] = useState("")

  const activeField =
    useMemo(() => {
      return fields.find(
        field =>
          field.key === activeKey
      ) || fields[0]
    }, [activeKey])

  const previewText =
    useMemo(() => {
      const base =
        botTexts[activeKey] || ""

      return base
        .replaceAll(
          "{{store_name}}",
          fullSettings?.store_name || "Nome da loja"
        )
        .replaceAll(
          "{{site_url}}",
          fullSettings?.site_url || "https://site-da-loja.com.br"
        )
        .replaceAll(
          "{{minimum_order}}",
          String(fullSettings?.minimum_order || "200")
        )
        .replaceAll(
          "{{sac_url}}",
          fullSettings?.sac_url || "Link do SAC"
        )
        .replaceAll(
          "{{group_url}}",
          fullSettings?.group_url || "Link do Grupo VIP"
        )
        .replaceAll(
          "{{instagram_url}}",
          fullSettings?.instagram_url || "Instagram"
        )
        .replaceAll(
          "{{telegram_url}}",
          fullSettings?.telegram_url || "Telegram"
        )
        .replaceAll(
          "{{pickup_address}}",
          fullSettings?.pickup_address || "Endereço de retirada"
        )
        .replaceAll(
          "{{pickup_hours}}",
          fullSettings?.pickup_hours || "Horário de retirada"
        )
        .replaceAll(
          "{{sac_hours}}",
          fullSettings?.sac_hours || "Horário do SAC"
        )
    }, [
      botTexts,
      activeKey,
      fullSettings
    ])

  useEffect(() => {
    loadSettings()
  }, [])

  function updateText(
    key: keyof BotTexts,
    value: string
  ) {
    setSaved(false)
    setError("")

    setBotTexts(prev => ({
      ...prev,
      [key]: value
    }))
  }

  async function loadSettings() {
    setLoading(true)
    setError("")

    try {
      const {
        data,
        error
      } = await supabase
        .from("store_settings")
        .select("*")
        .eq("store_key", "default")
        .maybeSingle()

      if (error) {
        throw error
      }

      const currentSettings =
        data?.settings || {}

      setFullSettings(currentSettings)

      setBotTexts(
        normalizeBotTexts(
          currentSettings?.bot_texts
        )
      )

    } catch (err: any) {
      console.error(
        "❌ erro carregar textos do bot:",
        err
      )

      setError(
        err?.message ||
        "Não consegui carregar os textos do bot."
      )

    } finally {
      setLoading(false)
    }
  }

  async function saveTexts() {
    setSaving(true)
    setSaved(false)
    setError("")

    try {
      const nextSettings = {
        ...(fullSettings || {}),
        bot_texts:
          botTexts,
        updated_from:
          "dashboard_textos_bot",
        updated_at:
          new Date().toISOString()
      }

      const {
        error
      } = await supabase
        .from("store_settings")
        .upsert(
          {
            store_key:
              "default",
            settings:
              nextSettings,
            updated_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "store_key"
          }
        )

      if (error) {
        throw error
      }

      setFullSettings(nextSettings)

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2800)

    } catch (err: any) {
      console.error(
        "❌ erro salvar textos do bot:",
        err
      )

      setError(
        err?.message ||
        "Não consegui salvar os textos do bot."
      )

    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          Carregando textos do bot...
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.topbar}>
        <div>
          <Link
            href="/dashboard/configuracoes"
            className={styles.backLink}
          >
            ← Voltar para configurações
          </Link>

          <h1>
            Textos do bot
          </h1>

          <p>
            Edite as respostas principais usadas pelo atendimento automático.
            Essas mensagens podem ser personalizadas conforme a linguagem da loja.
          </p>
        </div>

        <button
          type="button"
          className={styles.saveButton}
          onClick={saveTexts}
          disabled={saving}
        >
          {saving
            ? "Salvando..."
            : "Salvar textos"}
        </button>
      </div>

      {saved && (
        <div className={styles.successAlert}>
          Textos salvos com sucesso.
        </div>
      )}

      {error && (
        <div className={styles.errorAlert}>
          {error}
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <span className={styles.sidebarLabel}>
            Categorias
          </span>

          {fields.map((field) => (
            <button
              key={field.key}
              type="button"
              className={
                activeKey === field.key
                  ? `${styles.navButton} ${styles.navButtonActive}`
                  : styles.navButton
              }
              onClick={() =>
                setActiveKey(field.key)
              }
            >
              <strong>
                {field.title}
              </strong>

              <span>
                {field.description}
              </span>
            </button>
          ))}
        </aside>

        <main className={styles.editor}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Bot
              </span>

              <h2>
                {activeField.title}
              </h2>

              <p>
                {activeField.description}
              </p>
            </div>

            <label className={styles.field}>
              <span>
                Mensagem
              </span>

              <textarea
                value={botTexts[activeKey]}
                onChange={(event) =>
                  updateText(
                    activeKey,
                    event.target.value
                  )
                }
                placeholder={activeField.placeholder}
                rows={14}
              />
            </label>

            <div className={styles.variablesBox}>
              <strong>
                Variáveis disponíveis:
              </strong>

              <div>
                <code>
                  {"{{store_name}}"}
                </code>

                <code>
                  {"{{site_url}}"}
                </code>

                <code>
                  {"{{minimum_order}}"}
                </code>

                <code>
                  {"{{sac_url}}"}
                </code>

                <code>
                  {"{{group_url}}"}
                </code>

                <code>
                  {"{{pickup_address}}"}
                </code>

                <code>
                  {"{{pickup_hours}}"}
                </code>

                <code>
                  {"{{sac_hours}}"}
                </code>
              </div>
            </div>
          </section>

          <section className={styles.previewCard}>
            <span className={styles.previewLabel}>
              Prévia da resposta
            </span>

            <div className={styles.messagePreview}>
              {previewText}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}