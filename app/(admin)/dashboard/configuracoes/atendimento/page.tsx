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

import styles from "./atendimento.module.css"

const supabase =
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

type AtendimentoSettings = {
  has_physical_store: boolean
  physical_store_message: string
  pickup_enabled: boolean
  pickup_address: string
  pickup_hours: string
  sac_hours: string
  business_hours_message: string
  human_support_message: string
}

const defaultSettings: AtendimentoSettings = {
  has_physical_store: false,

  physical_store_message:
    "No momento não temos loja física aberta ao público 💗\n\nAs compras podem ser feitas pelo site:\n{{site_url}}\n\nTambém conseguimos ajudar por aqui no WhatsApp.",

  pickup_enabled: true,

  pickup_address:
    "Estrada Sebastião Walter Fusco 423, Cidade SOIMCO, Guarulhos, São Paulo (CEP 07183000)",

  pickup_hours:
    "Segunda a quinta: das 7h às 14h30\nSexta e sábado: das 7h às 12h30",

  sac_hours:
    "Segunda a quinta: das 7h às 14h30\nSexta e sábado: das 7h às 12h30",

  business_hours_message:
    "O site funciona 24 horas, amiga 💗\n\nNão temos mais loja física.\n\nHorário de retirada na sede e atendimento do SAC:\n• Segunda a quinta: das 7h às 14h30\n• Sexta e sábado: das 7h às 12h30\n\nAs compras podem ser feitas pelo site a qualquer horário.",

  human_support_message:
    "Claro, amiga 💗\n\nVou pausar o atendimento automático e deixar uma pessoa da equipe continuar por aqui.\n\nPode aguardar um pouquinho, tá?"
}

function normalizeSettings(value: any): AtendimentoSettings {
  const botTexts =
    value?.bot_texts || {}

  return {
    ...defaultSettings,

    has_physical_store:
      value?.has_physical_store ??
      defaultSettings.has_physical_store,

    pickup_enabled:
      value?.pickup_enabled ??
      defaultSettings.pickup_enabled,

    pickup_address:
      value?.pickup_address ??
      defaultSettings.pickup_address,

    pickup_hours:
      value?.pickup_hours ??
      defaultSettings.pickup_hours,

    sac_hours:
      value?.sac_hours ??
      defaultSettings.sac_hours,

    business_hours_message:
      value?.business_hours_message ??
      defaultSettings.business_hours_message,

    physical_store_message:
      botTexts?.physical_store_message ??
      value?.physical_store_message ??
      defaultSettings.physical_store_message,

    human_support_message:
      botTexts?.human_support_message ??
      value?.human_support_message ??
      defaultSettings.human_support_message
  }
}

export default function AtendimentoPage() {
  const [
    settings,
    setSettings
  ] = useState<AtendimentoSettings>(defaultSettings)

  const [
    fullSettings,
    setFullSettings
  ] = useState<any>({})

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

  const previewBusinessHours =
    useMemo(() => {
      return replaceVariables(
        settings.business_hours_message,
        {
          ...fullSettings,
          ...settings
        }
      )
    }, [
      settings,
      fullSettings
    ])

  const previewPhysicalStore =
    useMemo(() => {
      return replaceVariables(
        settings.physical_store_message,
        {
          ...fullSettings,
          ...settings
        }
      )
    }, [
      settings,
      fullSettings
    ])

  useEffect(() => {
    loadSettings()
  }, [])

  function replaceVariables(
    text: string,
    data: any
  ) {
    return String(text || "")
      .replaceAll(
        "{{store_name}}",
        data?.store_name || "Nome da loja"
      )
      .replaceAll(
        "{{site_url}}",
        data?.site_url || "https://site-da-loja.com.br"
      )
      .replaceAll(
        "{{minimum_order}}",
        String(data?.minimum_order || "200")
      )
      .replaceAll(
        "{{sac_url}}",
        data?.sac_url || "Link do SAC"
      )
      .replaceAll(
        "{{pickup_address}}",
        data?.pickup_address || "Endereço de retirada"
      )
      .replaceAll(
        "{{pickup_hours}}",
        data?.pickup_hours || "Horário de retirada"
      )
      .replaceAll(
        "{{sac_hours}}",
        data?.sac_hours || "Horário do SAC"
      )
  }

  function updateField<K extends keyof AtendimentoSettings>(
    field: K,
    value: AtendimentoSettings[K]
  ) {
    setSaved(false)
    setError("")

    setSettings(prev => ({
      ...prev,
      [field]: value
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

      setSettings(
        normalizeSettings(currentSettings)
      )

    } catch (err: any) {
      console.error(
        "❌ erro carregar atendimento:",
        err
      )

      setError(
        err?.message ||
        "Não consegui carregar as configurações de atendimento."
      )

    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setError("")

    try {
      const currentBotTexts =
        fullSettings?.bot_texts || {}

      const nextSettings = {
        ...(fullSettings || {}),

        has_physical_store:
          settings.has_physical_store,

        pickup_enabled:
          settings.pickup_enabled,

        pickup_address:
          settings.pickup_address,

        pickup_hours:
          settings.pickup_hours,

        sac_hours:
          settings.sac_hours,

        business_hours_message:
          settings.business_hours_message,

        bot_texts: {
          ...currentBotTexts,

          physical_store_message:
            settings.physical_store_message,

          human_support_message:
            settings.human_support_message
        },

        updated_from:
          "dashboard_atendimento",

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

      setSettings(
        normalizeSettings(nextSettings)
      )

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2800)

    } catch (err: any) {
      console.error(
        "❌ erro salvar atendimento:",
        err
      )

      setError(
        err?.message ||
        "Não consegui salvar as configurações de atendimento."
      )

    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          Carregando atendimento e retirada...
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
            Atendimento e retirada
          </h1>

          <p>
            Configure loja física, retirada na sede, horários de atendimento,
            mensagem oficial de funcionamento e transferência para humano.
          </p>
        </div>

        <button
          type="button"
          className={styles.saveButton}
          onClick={saveSettings}
          disabled={saving}
        >
          {saving
            ? "Salvando..."
            : "Salvar atendimento"}
        </button>
      </div>

      {saved && (
        <div className={styles.successAlert}>
          Configurações salvas com sucesso.
        </div>
      )}

      {error && (
        <div className={styles.errorAlert}>
          {error}
        </div>
      )}

      <div className={styles.layout}>
        <main className={styles.formColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Funcionamento
              </span>

              <h2>
                Loja física e retirada
              </h2>

              <p>
                Defina se existe atendimento presencial e se a loja permite
                retirada de pedidos na sede.
              </p>
            </div>

            <div className={styles.switchGrid}>
              <label className={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={settings.has_physical_store}
                  onChange={(event) =>
                    updateField(
                      "has_physical_store",
                      event.target.checked
                    )
                  }
                />

                <div>
                  <strong>
                    Tem loja física
                  </strong>

                  <span>
                    Ative somente se existe atendimento presencial aberto ao público.
                  </span>
                </div>
              </label>

              <label className={styles.switchRow}>
                <input
                  type="checkbox"
                  checked={settings.pickup_enabled}
                  onChange={(event) =>
                    updateField(
                      "pickup_enabled",
                      event.target.checked
                    )
                  }
                />

                <div>
                  <strong>
                    Tem retirada na sede
                  </strong>

                  <span>
                    Ative se a cliente pode retirar pedido depois de separado.
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Horários
              </span>

              <h2>
                SAC e retirada
              </h2>

              <p>
                Esses horários podem ser usados nas respostas automáticas do bot.
              </p>
            </div>

            <label className={styles.field}>
              <span>
                Horário do SAC
              </span>

              <textarea
                value={settings.sac_hours}
                onChange={(event) =>
                  updateField(
                    "sac_hours",
                    event.target.value
                  )
                }
                rows={4}
              />
            </label>

            <label className={styles.field}>
              <span>
                Endereço da retirada
              </span>

              <textarea
                value={settings.pickup_address}
                onChange={(event) =>
                  updateField(
                    "pickup_address",
                    event.target.value
                  )
                }
                rows={4}
              />
            </label>

            <label className={styles.field}>
              <span>
                Horário da retirada
              </span>

              <textarea
                value={settings.pickup_hours}
                onChange={(event) =>
                  updateField(
                    "pickup_hours",
                    event.target.value
                  )
                }
                rows={4}
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Respostas
              </span>

              <h2>
                Mensagens principais
              </h2>

              <p>
                Textos usados quando a cliente pergunta sobre horário,
                loja física, retirada ou atendimento humano.
              </p>
            </div>

            <label className={styles.field}>
              <span>
                Texto oficial de horário e funcionamento
              </span>

              <textarea
                value={settings.business_hours_message}
                onChange={(event) =>
                  updateField(
                    "business_hours_message",
                    event.target.value
                  )
                }
                rows={9}
              />
            </label>

            <label className={styles.field}>
              <span>
                Texto sobre loja física
              </span>

              <textarea
                value={settings.physical_store_message}
                onChange={(event) =>
                  updateField(
                    "physical_store_message",
                    event.target.value
                  )
                }
                rows={7}
              />
            </label>

            <label className={styles.field}>
              <span>
                Texto para atendimento humano
              </span>

              <textarea
                value={settings.human_support_message}
                onChange={(event) =>
                  updateField(
                    "human_support_message",
                    event.target.value
                  )
                }
                rows={7}
              />
            </label>
          </section>
        </main>

        <aside className={styles.previewColumn}>
          <div className={styles.previewCard}>
            <span className={styles.previewLabel}>
              Prévia
            </span>

            <h3>
              Horário de funcionamento
            </h3>

            <div className={styles.messagePreview}>
              {previewBusinessHours}
            </div>
          </div>

          <div className={styles.previewCard}>
            <span className={styles.previewLabel}>
              Prévia
            </span>

            <h3>
              Loja física
            </h3>

            <div className={styles.messagePreview}>
              {previewPhysicalStore}
            </div>
          </div>

          <div className={styles.helpCard}>
            <h3>
              Variáveis disponíveis
            </h3>

            <p>
              Use essas variáveis dentro dos textos:
            </p>

            <ul>
              <li>
                {"{{store_name}}"}
              </li>

              <li>
                {"{{site_url}}"}
              </li>

              <li>
                {"{{minimum_order}}"}
              </li>

              <li>
                {"{{sac_url}}"}
              </li>

              <li>
                {"{{pickup_address}}"}
              </li>

              <li>
                {"{{pickup_hours}}"}
              </li>

              <li>
                {"{{sac_hours}}"}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}