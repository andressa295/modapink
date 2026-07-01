"use client"

import { useEffect, useMemo, useState } from "react"

import Link from "next/link"

import { createBrowserClient } from "@supabase/ssr"

import styles from "./dados-loja.module.css"

const supabase =
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

type StoreSettings = {
  store_name: string
  site_url: string
  minimum_order: number | string
  sac_url: string
  instagram_url: string
  group_url: string
  telegram_url: string
  sac_hours: string
  pickup_enabled: boolean
  pickup_address: string
  pickup_hours: string
  has_physical_store: boolean
  business_hours_message: string
}

const defaultSettings: StoreSettings = {
  store_name: "Moda Pink",
  site_url: "https://atacadomodapink.com.br",
  minimum_order: 200,
  sac_url: "",
  instagram_url: "",
  group_url: "",
  telegram_url: "",
  sac_hours:
    "Segunda a quinta das 07:00 às 14:30. Sexta e sábado das 07:00 às 12:30",
  pickup_enabled: true,
  pickup_address:
    "Estrada Sebastião Walter Fusco 423, Cidade SOIMCO, Guarulhos, São Paulo (CEP 07183000)",
  pickup_hours:
    "Segunda a quinta das 07:00 às 14:30. Sexta e sábado das 07:00 às 12:30",
  has_physical_store: false,
  business_hours_message:
    "O site funciona 24 horas, amiga 💗\n\nNão temos mais loja física.\n\nHorário de retirada na sede e atendimento do SAC:\n• Segunda a quinta: das 7h às 14h30\n• Sexta e sábado: das 7h às 12h30\n\nAs compras podem ser feitas pelo site a qualquer horário."
}

function normalizeSettings(value: any): StoreSettings {
  return {
    ...defaultSettings,
    ...(value || {}),
    minimum_order:
      value?.minimum_order ??
      defaultSettings.minimum_order,
    pickup_enabled:
      value?.pickup_enabled ??
      defaultSettings.pickup_enabled,
    has_physical_store:
      value?.has_physical_store ??
      defaultSettings.has_physical_store
  }
}

export default function DadosLojaPage() {
  const [
    settings,
    setSettings
  ] = useState<StoreSettings>(defaultSettings)

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

  const previewText =
    useMemo(() => {
      return settings.business_hours_message
        .replaceAll("{{store_name}}", settings.store_name || "")
        .replaceAll("{{site_url}}", settings.site_url || "")
        .replaceAll("{{minimum_order}}", String(settings.minimum_order || ""))
        .replaceAll("{{pickup_address}}", settings.pickup_address || "")
        .replaceAll("{{pickup_hours}}", settings.pickup_hours || "")
        .replaceAll("{{sac_hours}}", settings.sac_hours || "")
    }, [settings])

  useEffect(() => {
    loadSettings()
  }, [])

  function updateField<K extends keyof StoreSettings>(
    field: K,
    value: StoreSettings[K]
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

      if (data?.settings) {
        setSettings(
          normalizeSettings(data.settings)
        )
      } else {
        setSettings(defaultSettings)
      }

    } catch (err: any) {
      console.error(
        "❌ erro carregar dados da loja:",
        err
      )

      setError(
        err?.message ||
        "Não consegui carregar os dados da loja."
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
      const cleanSettings = {
        ...settings,
        minimum_order:
          Number(settings.minimum_order || 0),
        updated_from:
          "dashboard",
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
              cleanSettings,
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

      setSettings(
        normalizeSettings(cleanSettings)
      )

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2800)

    } catch (err: any) {
      console.error(
        "❌ erro salvar dados da loja:",
        err
      )

      setError(
        err?.message ||
        "Não consegui salvar os dados da loja."
      )

    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          Carregando dados da loja...
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
            Dados da loja
          </h1>

          <p>
            Configure as informações principais usadas pelo painel,
            bot e automações da loja.
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
            : "Salvar alterações"}
        </button>
      </div>

      {saved && (
        <div className={styles.successAlert}>
          Dados salvos com sucesso.
        </div>
      )}

      {error && (
        <div className={styles.errorAlert}>
          {error}
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Base
              </span>

              <h2>
                Informações principais
              </h2>

              <p>
                Dados usados para identificar a loja e montar respostas básicas.
              </p>
            </div>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>
                  Nome da loja
                </span>

                <input
                  value={settings.store_name}
                  onChange={(event) =>
                    updateField(
                      "store_name",
                      event.target.value
                    )
                  }
                  placeholder="Ex: Moda Pink"
                />
              </label>

              <label className={styles.field}>
                <span>
                  Pedido mínimo
                </span>

                <input
                  type="number"
                  min="0"
                  value={settings.minimum_order}
                  onChange={(event) =>
                    updateField(
                      "minimum_order",
                      event.target.value
                    )
                  }
                  placeholder="Ex: 200"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>
                Site da loja
              </span>

              <input
                value={settings.site_url}
                onChange={(event) =>
                  updateField(
                    "site_url",
                    event.target.value
                  )
                }
                placeholder="https://site-da-loja.com.br"
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Links
              </span>

              <h2>
                Canais da loja
              </h2>

              <p>
                Links usados pelo bot nas respostas de atendimento.
              </p>
            </div>

            <label className={styles.field}>
              <span>
                Link do SAC
              </span>

              <input
                value={settings.sac_url}
                onChange={(event) =>
                  updateField(
                    "sac_url",
                    event.target.value
                  )
                }
                placeholder="https://wa.me/..."
              />
            </label>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>
                  Instagram
                </span>

                <input
                  value={settings.instagram_url}
                  onChange={(event) =>
                    updateField(
                      "instagram_url",
                      event.target.value
                    )
                  }
                  placeholder="https://instagram.com/..."
                />
              </label>

              <label className={styles.field}>
                <span>
                  Grupo VIP
                </span>

                <input
                  value={settings.group_url}
                  onChange={(event) =>
                    updateField(
                      "group_url",
                      event.target.value
                    )
                  }
                  placeholder="https://chat.whatsapp.com/..."
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>
                Telegram
              </span>

              <input
                value={settings.telegram_url}
                onChange={(event) =>
                  updateField(
                    "telegram_url",
                    event.target.value
                  )
                }
                placeholder="https://t.me/..."
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Atendimento
              </span>

              <h2>
                SAC, retirada e loja física
              </h2>

              <p>
                Defina como a loja funciona para atendimento, retirada e presença física.
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
                    Marque se existe atendimento presencial aberto ao público.
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
                    Marque se pedidos finalizados podem ser retirados.
                  </span>
                </div>
              </label>
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
                rows={3}
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
                rows={3}
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
                rows={3}
              />
            </label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                Bot
              </span>

              <h2>
                Texto oficial de horário
              </h2>

              <p>
                Esse texto será usado quando a cliente perguntar sobre horário,
                atendimento, SAC, loja física ou retirada.
              </p>
            </div>

            <label className={styles.field}>
              <span>
                Mensagem do bot
              </span>

              <textarea
                value={settings.business_hours_message}
                onChange={(event) =>
                  updateField(
                    "business_hours_message",
                    event.target.value
                  )
                }
                rows={10}
              />
            </label>
          </section>
        </div>

        <aside className={styles.previewColumn}>
          <div className={styles.previewCard}>
            <span className={styles.previewLabel}>
              Prévia da resposta
            </span>

            <h3>
              Horário de funcionamento
            </h3>

            <div className={styles.messagePreview}>
              {previewText}
            </div>
          </div>

          <div className={styles.helpCard}>
            <h3>
              Variáveis disponíveis
            </h3>

            <p>
              Você pode usar essas variáveis dentro do texto:
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
