"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Download,
  Percent,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
  WalletCards
} from "lucide-react"
import styles from "../styles/relatorios.module.css"

type RangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "week"
  | "month"
  | "previous_month"
  | "custom"

type Detail = {
  label: string
  orders: number
  received?: number
  charged?: number
}

type Movement = {
  id: string
  date: string
  orderNumber: string
  customer: string
  type: "sale" | "refund"
  paymentGroup: string
  paymentLabel: string
  shippingGroup: string
  shippingLabel: string
  itemCount: number
  productNet: number
  discount: number
  freight: number
  totalReceived: number
  paymentFee: number
  refund: number
  net: number
  feeEstimated: boolean
}

type Summary = {
  orders: number
  items: number
  salesWithoutFreight: number
  discounts: number
  freight: number
  totalReceived: number
  paymentFees: number
  refunds: number
  net: number
  ticketWithoutFreight: number
  estimatedFeeOrders: number
}

type Method = {
  orders: number
  received: number
  fees: number
  refunds: number
  net: number
  details: Detail[]
}

type ShippingMethod = {
  orders: number
  salesWithoutFreight: number
  charged: number
  paymentFees: number
  refunds: number
  net: number
  details: Detail[]
}

type ResponseData = {
  generatedAt: string
  source: "database"
  range: {
    label: string
    from: string
    to: string
  }
  metrics: Summary
  methods: {
    pix: Method
    card: Method
    cash: Method
    other: Method
  }
  shipping: {
    bus: ShippingMethod
    postal: ShippingMethod
    motoboy: ShippingMethod
    pickup: ShippingMethod
    unknown: ShippingMethod
  }
  chart: Array<{
    date: string
    sales: number
    fees: number
    refunds: number
    net: number
  }>
  movements: Movement[]
  feeConfig: {
    pixPercent: number
    cardPercent: number
    cardFixedFee: number
    otherPercent: number
    estimatedFeeOrders: number
  }
}

type CacheEntry = {
  expiresAt: number
  data: ResponseData
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
})

const number = new Intl.NumberFormat("pt-BR")
const REPORT_CACHE_MS = 60_000
const reportCache = new Map<string, CacheEntry>()
const reportRequests = new Map<string, Promise<ResponseData>>()

const ranges: Array<{ value: RangeKey; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "previous_month", label: "Mês anterior" }
]

function formatDate(value: string, time = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date)
}

function reportKey(
  selected: RangeKey,
  from = "",
  to = ""
) {
  return selected === "custom"
    ? `${selected}:${from}:${to}`
    : selected
}

async function requestReport(
  selected: RangeKey,
  from = "",
  to = "",
  force = false
) {
  const key = reportKey(selected, from, to)
  const cached = reportCache.get(key)

  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  if (!force) {
    const pending = reportRequests.get(key)
    if (pending) return pending
  }

  const params = new URLSearchParams({ range: selected })

  if (selected === "custom") {
    params.set("from", from)
    params.set("to", to)
  }

  if (force) {
    params.set("refresh", "1")
  }

  const request = fetch(`/api/reports/financial?${params.toString()}`)
    .then(async (response) => {
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error ||
          "Erro ao carregar o financeiro"
        )
      }

      reportCache.set(key, {
        data: payload,
        expiresAt: Date.now() + REPORT_CACHE_MS
      })

      return payload as ResponseData
    })
    .finally(() => {
      reportRequests.delete(key)
    })

  reportRequests.set(key, request)

  return request
}

function Card({
  title,
  value,
  detail,
  icon,
  tone = "normal"
}: {
  title: string
  value: string
  detail: string
  icon: React.ReactNode
  tone?: string
}) {
  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.cardHeader}>
        <span>{title}</span>
        <span className={styles.cardIcon} aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function MethodCard({
  title,
  icon,
  data,
  showDetails = false
}: {
  title: string
  icon: React.ReactNode
  data: Method
  showDetails?: boolean
}) {
  return (
    <div className={styles.methodCard}>
      <div className={styles.methodTitle}>
        {icon}
        <div>
          <strong>{title}</strong>
          <span>{number.format(data.orders)} pedidos</span>
        </div>
      </div>

      <div className={styles.methodNet}>
        <span>Líquido</span>
        <strong>{money.format(data.net)}</strong>
      </div>

      <div className={styles.methodRows}>
        <span>
          Recebido
          <b>{money.format(data.received)}</b>
        </span>
        <span>
          Taxas
          <b>{money.format(data.fees)}</b>
        </span>
        <span>
          Estornos
          <b>{money.format(data.refunds)}</b>
        </span>

        {showDetails && data.details.map((detail) => (
          <span key={detail.label}>
            {detail.label}
            <b>
              {number.format(detail.orders)} ped.
            </b>
          </span>
        ))}
      </div>
    </div>
  )
}

function ShippingCard({
  title,
  data,
  detailFallback
}: {
  title: string
  data: ShippingMethod
  detailFallback: string
}) {
  return (
    <div className={styles.methodCard}>
      <div className={styles.methodTitle}>
        <Truck size={20} />
        <div>
          <strong>{title}</strong>
          <span>{number.format(data.orders)} pedidos</span>
        </div>
      </div>

      <div className={styles.methodNet}>
        <span>Valor total do frete</span>
        <strong>{money.format(data.charged)}</strong>
      </div>

      <div className={styles.methodRows}>
        <span>
          Produtos
          <b>{money.format(data.salesWithoutFreight)}</b>
        </span>
        <span>
          Taxas de pagamento
          <b>{money.format(data.paymentFees)}</b>
        </span>
        <span>
          Estornos
          <b>{money.format(data.refunds)}</b>
        </span>
        <span>
          Líquido
          <b>{money.format(data.net)}</b>
        </span>

        {data.details.length > 0 ? (
          data.details.map((detail) => (
            <span key={detail.label}>
              {detail.label}
              <b>
                {number.format(detail.orders)} ped.
              </b>
            </span>
          ))
        ) : (
          <span>
            Detalhe
            <b>{detailFallback}</b>
          </span>
        )}
      </div>
    </div>
  )
}

export default function Relatorios() {
  const [range, setRange] = useState<RangeKey>("today")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")

  async function load(
    selected = range,
    force = false
  ) {
    setLoading(true)
    setError("")

    try {
      if (selected === "custom" && (!from || !to)) {
        throw new Error("Escolha a data inicial e final.")
      }

      const payload = await requestReport(
        selected,
        from,
        to,
        force
      )

      setData(payload)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar o financeiro"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(range)
  }, [range])

  useEffect(() => {
    if (!data || range !== "today") return

    const timer = window.setTimeout(() => {
      for (const item of ranges) {
        if (item.value === "today") continue

        void requestReport(item.value).catch(() => {
          // Pré-carregamento silencioso.
        })
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [data, range])

  const movements = useMemo(() => {
    return (data?.movements || []).filter((item) => {
      const term = search.toLowerCase().trim()
      const matchType =
        type === "all" ||
        item.type === type

      const matchSearch =
        !term ||
        item.orderNumber.toLowerCase().includes(term) ||
        item.customer.toLowerCase().includes(term) ||
        item.paymentLabel.toLowerCase().includes(term) ||
        item.shippingLabel.toLowerCase().includes(term)

      return matchType && matchSearch
    })
  }, [data, search, type])

  function exportCsv() {
    if (!data) return

    const rows = [
      [
        "Data",
        "Pedido",
        "Cliente",
        "Movimentação",
        "Pagamento",
        "Tipo de frete",
        "Entrega",
        "Venda sem frete",
        "Frete",
        "Taxa de pagamento",
        "Estorno",
        "Líquido"
      ],
      ...movements.map((item) => [
        formatDate(item.date, true),
        item.orderNumber,
        item.customer,
        item.type === "refund" ? "Estorno" : "Pagamento",
        item.paymentLabel,
        item.shippingGroup,
        item.shippingLabel,
        item.productNet,
        item.freight,
        item.paymentFee,
        item.refund,
        item.net
      ])
    ]

    const csv = rows
      .map((row) => {
        return row
          .map((value) => {
            return `"${String(value).replace(/"/g, '""')}"`
          })
          .join(";")
      })
      .join("\n")

    const link = document.createElement("a")

    link.href = URL.createObjectURL(
      new Blob(
        ["\ufeff" + csv],
        { type: "text/csv;charset=utf-8" }
      )
    )

    link.download =
      `financeiro-${data.range.from}-${data.range.to}.csv`

    link.click()
    URL.revokeObjectURL(link.href)
  }

  const maxChart = Math.max(
    1,
    ...(data?.chart || []).flatMap((item) => [
      item.sales,
      item.refunds
    ])
  )

  return (
    <main className={styles.page} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>FINANCEIRO DA LOJA</span>
          <h1>Relatórios</h1>
          <p>
            Vendas, recebimentos e entregas em uma visão organizada.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={() => load(range, true)}
            disabled={loading}
          >
            <RefreshCcw
              size={17}
              className={loading ? styles.spin : ""}
            />
            Atualizar
          </button>

          <button
            type="button"
            className={styles.export}
            onClick={exportCsv}
            disabled={!data}
          >
            <Download size={17} />
            Exportar CSV
          </button>
        </div>
      </header>

      <section className={styles.filters} aria-label="Período do relatório">
        <div className={styles.quickFilters} role="group" aria-label="Períodos rápidos">
          {ranges.map((item) => (
            <button
              type="button"
              key={item.value}
              aria-pressed={range === item.value}
              className={
                range === item.value
                  ? styles.active
                  : ""
              }
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.custom}>
          <CalendarDays size={16} aria-hidden="true" />
          <input
            type="date"
            aria-label="Data inicial"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />

          <span>até</span>

          <input
            type="date"
            aria-label="Data final"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />

          <button
            type="button"
            onClick={() => {
              if (range === "custom") {
                load("custom")
              } else {
                setRange("custom")
              }
            }}
          >
            Aplicar
          </button>
        </div>
      </section>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className={styles.loading} role="status">
          <RefreshCcw className={styles.spin} />
          Carregando movimentações...
        </div>
      )}

      {data && (
        <>
          <div className={styles.period}>
            <strong>
              <CalendarDays size={14} aria-hidden="true" />
              {data.range.from.split("-").reverse().join("/")}
              {" a "}
              {data.range.to.split("-").reverse().join("/")}
            </strong>

            <span role="status">
              {loading
                ? "Atualizando em segundo plano..."
                : `Atualizado em ${formatDate(data.generatedAt, true)}`}
            </span>
          </div>

          <section className={styles.cards} aria-label="Resumo financeiro">
            <Card
              title="Venda sem frete"
              value={money.format(data.metrics.salesWithoutFreight)}
              detail={`${number.format(data.metrics.orders)} pedidos pagos`}
              icon={<ShoppingBag size={17} />}
              tone="pink"
            />

            <Card
              title="Frete cobrado"
              value={money.format(data.metrics.freight)}
              detail="Ônibus, Correios e motoboy separados abaixo"
              icon={<Truck size={17} />}
              tone="orange"
            />

            <Card
              title="Taxas de pagamento"
              value={money.format(data.metrics.paymentFees)}
              detail="Pix e cartão de crédito"
              icon={<CreditCard size={17} />}
            />

            <Card
              title="Estornos e reembolsos"
              value={money.format(data.metrics.refunds)}
              detail="Somente valores realmente devolvidos"
              icon={<ArrowUpRight size={17} />}
              tone="red"
            />

            <Card
              title="Total recebido"
              value={money.format(data.metrics.totalReceived)}
              detail="Produtos mais frete"
              icon={<ArrowDownLeft size={17} />}
            />

            <Card
              title="Líquido real"
              value={money.format(data.metrics.net)}
              detail="Recebido menos taxas e estornos"
              icon={<CircleDollarSign size={17} />}
              tone="green"
            />

            <Card
              title="Descontos"
              value={money.format(data.metrics.discounts)}
              detail="Cupons, Pix e promoções"
              icon={<Percent size={17} />}
            />

            <Card
              title="Ticket sem frete"
              value={money.format(data.metrics.ticketWithoutFreight)}
              detail={`${number.format(data.metrics.items)} itens vendidos`}
              icon={<ReceiptText size={17} />}
            />
          </section>

          {data.metrics.estimatedFeeOrders > 0 && (
            <div className={styles.warning}>
              <Percent size={18} />

              <span>
                <b>
                  {data.metrics.estimatedFeeOrders}
                  {" pedidos com taxa calculada."}
                </b>

                {" "}
                Pix{" "}
                {data.feeConfig.pixPercent
                  .toFixed(2)
                  .replace(".", ",")}
                %
                {" • "}
                Cartão de crédito{" "}
                {data.feeConfig.cardPercent
                  .toFixed(2)
                  .replace(".", ",")}
                %
                {" + "}
                {money.format(data.feeConfig.cardFixedFee)}
                {" por pedido."}
              </span>
            </div>
          )}

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <span>Entradas e saídas</span>
                <h2>Movimentação diária</h2>
                <p>O valor acima de cada coluna é o líquido do dia.</p>
              </div>

              <div className={styles.legend}>
                <span>
                  <i className={styles.salesDot} />
                  Entradas
                </span>

                <span>
                  <i className={styles.refundDot} />
                  Estornos
                </span>
              </div>
            </div>

            <div className={styles.chart}>
              {data.chart.length === 0 ? (
                <div className={styles.empty}>
                  Sem movimentações neste período.
                </div>
              ) : (
                data.chart.map((item) => (
                  <div
                    className={styles.chartItem}
                    key={item.date}
                    role="img"
                    aria-label={`${item.date.slice(8, 10)}/${item.date.slice(5, 7)}: entradas de ${money.format(item.sales)}, estornos de ${money.format(item.refunds)} e líquido de ${money.format(item.net)}`}
                    title={`Entradas: ${money.format(item.sales)} · Estornos: ${money.format(item.refunds)} · Líquido: ${money.format(item.net)}`}
                  >
                    <small>{money.format(item.net)}</small>

                    <div className={styles.bars}>
                      <i
                        className={styles.salesBar}
                        style={{
                          height: item.sales ?
                            `${Math.max(
                              2,
                              item.sales / maxChart * 100
                            )}%` : "0%"
                        }}
                      />

                      <i
                        className={styles.refundBar}
                        style={{
                          height: item.refunds
                            ? `${Math.max(
                              2,
                              item.refunds / maxChart * 100
                            )}%`
                            : "0%"
                        }}
                      />
                    </div>

                    <span>
                      {item.date.slice(8, 10)}
                      /
                      {item.date.slice(5, 7)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <span>Como o dinheiro entrou</span>
                <h2>Formas de pagamento</h2>
              </div>
            </div>

            <div className={styles.methods}>
              <MethodCard
                title="Pix"
                icon={<WalletCards size={20} />}
                data={data.methods.pix}
              />

              <MethodCard
                title="Cartão de crédito"
                icon={<CreditCard size={20} />}
                data={data.methods.card}
              />

              {data.methods.cash.orders > 0 && (
                <MethodCard
                  title="Dinheiro"
                  icon={<WalletCards size={20} />}
                  data={data.methods.cash}
                />
              )}

              {data.methods.other.orders > 0 && (
                <MethodCard
                  title="Outros pagamentos"
                  icon={<WalletCards size={20} />}
                  data={data.methods.other}
                  showDetails
                />
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.shippingPanel}`}>
            <div className={styles.panelTitle}>
              <div>
                <span>Quanto foi cobrado em cada tipo de entrega</span>
                <h2>Valores de frete</h2>
              </div>
            </div>

            <div className={styles.methods}>
              <ShippingCard
                title="Frete do ônibus"
                data={data.shipping.bus}
                detailFallback="Ônibus / excursão"
              />

              <ShippingCard
                title="Frete dos Correios"
                data={data.shipping.postal}
                detailFallback="PAC e Sedex"
              />

              <ShippingCard
                title="Frete do motoboy"
                data={data.shipping.motoboy}
                detailFallback="Entrega local"
              />

              {data.shipping.pickup.orders > 0 && (
                <ShippingCard
                  title="Retirada"
                  data={data.shipping.pickup}
                  detailFallback="Sem cobrança de frete"
                />
              )}

              {data.shipping.unknown.orders > 0 && (
                <ShippingCard
                  title="Frete não identificado"
                  data={data.shipping.unknown}
                  detailFallback="Verifique os nomes listados"
                />
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.tableHeader}>
              <div>
                <span>Detalhamento</span>
                <h2>Pagamentos e estornos</h2>
                <p>{number.format(movements.length)} movimentações encontradas</p>
              </div>

              <div className={styles.tableTools}>
                <label>
                  <Search size={16} />

                  <input
                    type="search"
                    aria-label="Buscar pedido, cliente, pagamento ou entrega"
                    placeholder="Pedido, cliente, pagamento ou entrega"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                    }}
                  />
                </label>

                <select
                  aria-label="Tipo de movimentação"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value)
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="sale">Pagamentos</option>
                  <option value="refund">Estornos</option>
                </select>
              </div>
            </div>

            <div className={styles.tableScroll} role="region" aria-label="Tabela de pagamentos e estornos" tabIndex={0}>
              <table>
                <caption className={styles.srOnly}>Movimentações financeiras do período selecionado.</caption>
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Pedido</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Movimentação</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col">Entrega</th>
                    <th scope="col">Sem frete</th>
                    <th scope="col">Frete</th>
                    <th scope="col">Taxa</th>
                    <th scope="col">Estorno</th>
                    <th scope="col">Líquido</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.date, true)}</td>

                      <td>
                        <b>#{item.orderNumber}</b>
                      </td>

                      <td>{item.customer}</td>

                      <td>
                        <span
                          className={
                            `${styles.badge} ${
                              item.type === "refund"
                                ? styles.badgeRefund
                                : styles.badgeSale
                            }`
                          }
                        >
                          {item.type === "refund"
                            ? "Estorno"
                            : "Pagamento"}
                        </span>
                      </td>

                      <td>
                        <b>{item.paymentLabel}</b>

                        {item.feeEstimated && (
                          <small className={styles.estimated}>
                            taxa calculada
                          </small>
                        )}
                      </td>

                      <td>
                        <b>{item.shippingLabel}</b>

                        {item.shippingGroup === "unknown" && (
                          <small className={styles.estimated}>
                            tipo não identificado
                          </small>
                        )}
                      </td>

                      <td>
                        {money.format(item.productNet)}
                      </td>

                      <td>
                        {money.format(item.freight)}
                      </td>

                      <td className={styles.negative}>
                        {item.paymentFee
                          ? `− ${money.format(item.paymentFee)}`
                          : "—"}
                      </td>

                      <td className={styles.negative}>
                        {item.refund
                          ? `− ${money.format(item.refund)}`
                          : "—"}
                      </td>

                      <td
                        className={
                          item.net < 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        <b>{money.format(item.net)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {movements.length === 0 && (
                <div className={styles.empty}>
                  Nenhuma movimentação encontrada.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
