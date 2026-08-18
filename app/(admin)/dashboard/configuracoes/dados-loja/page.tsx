"use client"

import { useEffect, useMemo, useState } from "react"

import Link from "next/link"

import {
  DEFAULT_STORE_SETTINGS,
  type StoreSettings
} from "@/lib/store-settings"

import {
  loadStoreSettings,
  patchStoreSettings
} from "@/lib/store-settings-client"

import styles from "./dados-loja.module.css"

export default function DadosLojaPage() {
  const [
    settings,
    setSettings
  ] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS)

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
      setSettings(await loadStoreSettings())

    } catch (err: unknown) {
      console.error(
        "❌ erro carregar dados da loja:",
        err
      )

      setError(
        (err instanceof Error ? err.message : "") ||
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
      const savedSettings = await patchStoreSettings(
        "dashboard_dados_loja",
        {
          store_name: settings.store_name,
          company_cnpj: settings.company_cnpj,
          site_url: settings.site_url,
          catalog_url: settings.catalog_url,
          minimum_order: settings.minimum_order,
          polyester_price: settings.polyester_price,
          pix_discount_percent: settings.pix_discount_percent,
          sac_url: settings.sac_url,
          instagram_url: settings.instagram_url,
          group_url: settings.group_url,
          telegram_url: settings.telegram_url,
          sac_hours: settings.sac_hours,
          pickup_enabled: settings.pickup_enabled,
          pickup_location: settings.pickup_location,
          pickup_address: settings.pickup_address,
          pickup_hours: settings.pickup_hours,
          has_physical_store: settings.has_physical_store,
          business_hours_message: settings.business_hours_message
        }
      )

      setSettings(savedSettings)

      setSaved(true)

      window.setTimeout(() => {
        setSaved(false)
      }, 2800)

    } catch (err: unknown) {
      console.error(
        "❌ erro salvar dados da loja:",
        err
      )

      setError(
        (err instanceof Error ? err.message : "") ||
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
                      Number(event.target.value)
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
                      Number(event.target.value)
                    )
                  }
                  placeholder="Ex: 250"
                />
              </label>
            </div>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span>
                  CNPJ da empresa
                </span>

                <input
                  value={settings.company_cnpj}
                  onChange={(event) =>
                    updateField(
                      "company_cnpj",
                      event.target.value
                    )
                  }
                  placeholder="00.000.000/0000-00"
                />
              </label>

              <label className={styles.field}>
                <span>
                  Preço da linha poliéster
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.polyester_price}
                  onChange={(event) =>
                    updateField(
                      "polyester_price",
                      Number(event.target.value)
                    )
                  }
                  placeholder="Ex: 12,00"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>
                Desconto no Pix (%)
              </span>

              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.pix_discount_percent}
                onChange={(event) =>
                  updateField(
                    "pix_discount_percent",
                    Number(event.target.value)
                  )
                }
                placeholder="Ex: 10"
              />
            </label>

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

            <label className={styles.field}>
              <span>
                Catálogo do WhatsApp
              </span>

              <input
                value={settings.catalog_url}
                onChange={(event) =>
                  updateField(
                    "catalog_url",
                    event.target.value
                  )
                }
                placeholder="https://modapink.phand.com.br"
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
