"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import {
  CheckCircle2,
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp
} from "lucide-react"

import {
  createClient
} from "@/lib/supabase/client"

import styles from "./SalesFunnel.module.css"

type FunnelData = {
  cartsSent: number
  cartsRecovered: number
  confirmedSales: number
  recoveredValue: number
}

type SalesFunnelRpcRow = {
  carts_sent: number | string | null
  carts_recovered: number | string | null
  confirmed_sales: number | string | null
  recovered_value: number | string | null
}

function toNumber(
  value: number | string | null | undefined
) {
  const parsed =
    Number(value || 0)

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function formatCurrency(
  value: number
) {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2
    }
  ).format(value)
}

export default function SalesFunnel() {
  const requestInFlightRef =
    useRef(false)

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    data,
    setData
  ] = useState<FunnelData>({
    cartsSent: 0,
    cartsRecovered: 0,
    confirmedSales: 0,
    recoveredValue: 0
  })

  useEffect(() => {
    const supabase =
      createClient()

    let active = true

    async function loadFunnel(
      showInitialLoading = false
    ) {
      if (requestInFlightRef.current) {
        return
      }

      requestInFlightRef.current = true

      try {
        if (showInitialLoading) {
          setLoading(true)
        }

        const {
          data: result,
          error
        } = await supabase
          .rpc("get_sales_funnel_total")

        if (error) {
          console.warn(
            "Não foi possível carregar funil comercial:",
            error
          )

          return
        }

        const row =
          Array.isArray(result)
            ? result[0] as SalesFunnelRpcRow | undefined
            : result as SalesFunnelRpcRow | undefined

        if (!active) {
          return
        }

        setData({
          cartsSent:
            toNumber(row?.carts_sent),

          cartsRecovered:
            toNumber(row?.carts_recovered),

          confirmedSales:
            toNumber(row?.confirmed_sales),

          recoveredValue:
            toNumber(row?.recovered_value)
        })
      } finally {
        requestInFlightRef.current = false

        if (active) {
          setLoading(false)
        }
      }
    }

    loadFunnel(true)

    const interval =
      window.setInterval(
        () => loadFunnel(false),
        30000
      )

    return () => {
      active = false
      requestInFlightRef.current = false

      window.clearInterval(
        interval
      )
    }
  }, [])

  const recoveryRate =
    useMemo(() => {
      if (
        data.cartsSent <= 0
      ) {
        return 0
      }

      return Math.round(
        (
          data.cartsRecovered /
          data.cartsSent
        ) * 100
      )
    }, [
      data.cartsRecovered,
      data.cartsSent
    ])

  const maxValue =
    Math.max(
      data.cartsSent,
      data.cartsRecovered,
      data.confirmedSales,
      1
    )

  const funnelItems = [
    {
      label: "Carrinhos enviados",
      value: data.cartsSent,
      icon: ShoppingCart,
      description: "Recuperações disparadas pelo WhatsApp"
    },
    {
      label: "Carrinhos recuperados",
      value: data.cartsRecovered,
      icon: TrendingUp,
      description: "Carrinhos que voltaram e viraram compra"
    },
    {
      label: "Vendas confirmadas",
      value: data.confirmedSales,
      icon: CheckCircle2,
      description: "Compras recuperadas pelo WhatsApp"
    },
    {
      label: "Valor recuperado",
      value: formatCurrency(data.recoveredValue),
      icon: DollarSign,
      description: "Total recuperado pelos carrinhos"
    }
  ]

  return (
    <article className={styles["sales-funnel-card"]}>
      <div className={styles["card-glow"]} />

      <header className={styles["sales-funnel-header"]}>
        <div className={styles["title-group"]}>
          <span className={styles["title-icon"]}>
            <ShoppingBag size={18} />
          </span>

          <div>
            <span className={styles["eyebrow"]}>
              Vendas pelo WhatsApp
            </span>

            <h3>
              Funil comercial total
            </h3>
          </div>
        </div>

        <div className={styles["rate-pill"]}>
          <Sparkles size={13} />

          {loading
            ? "—"
            : `${recoveryRate}% recuperação`}
        </div>
      </header>

      <div className={styles["funnel-list"]}>
        {funnelItems.map((item) => {
          const Icon =
            item.icon

          const numericValue =
            typeof item.value === "number"
              ? item.value
              : data.recoveredValue

          const width =
            `${Math.max(
              (
                Number(numericValue || 0) /
                maxValue
              ) * 100,
              Number(numericValue || 0) > 0
                ? 18
                : 4
            )}%`

          return (
            <div
              key={item.label}
              className={styles["funnel-item"]}
            >
              <div className={styles["funnel-item-top"]}>
                <div className={styles["funnel-label"]}>
                  <span className={styles["funnel-icon"]}>
                    <Icon size={14} />
                  </span>

                  <div>
                    <strong>
                      {item.label}
                    </strong>

                    <small>
                      {item.description}
                    </small>
                  </div>
                </div>

                <span className={styles["funnel-value"]}>
                  {loading
                    ? "—"
                    : item.value}
                </span>
              </div>

              <div className={styles["funnel-track"]}>
                <div
                  className={styles["funnel-fill"]}
                  style={{
                    width
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
