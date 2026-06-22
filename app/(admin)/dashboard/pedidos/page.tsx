"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"

import styles from "../styles/pedidos.module.css"

// ======================
// TYPES
// ======================

type Order = {
  id: number
  customer: string
  phone?: string
  status: string
  shipping_status?: string
  shipping_method?: string
  total: number
  date: string
  payment_method?: string
}

type OrderStatus = {
  label: string
  className: string
  type: "paid" | "pending" | "cancelled" | "other"
}

type FilterType =
  | "all"
  | "paid"
  | "pending"
  | "cancelled"

// ======================
// HELPERS
// ======================

function normalizeText(
  value: string
) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function formatCurrency(
  value: number
) {
  return Number(value || 0)
    .toLocaleString(
      "pt-BR",
      {
        style:
          "currency",
        currency:
          "BRL"
      }
    )
}

function formatDate(
  date: string
) {
  if (!date) {
    return "—"
  }

  const parsedDate =
    new Date(date)

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "—"
  }

  return parsedDate
    .toLocaleDateString(
      "pt-BR",
      {
        day:
          "2-digit",
        month:
          "2-digit",
        year:
          "numeric"
      }
    )
}

function formatTime(
  date: string
) {
  if (!date) {
    return ""
  }

  const parsedDate =
    new Date(date)

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return ""
  }

  return parsedDate
    .toLocaleTimeString(
      "pt-BR",
      {
        hour:
          "2-digit",
        minute:
          "2-digit"
      }
    )
}

function formatPhone(
  phone?: string
) {
  if (!phone) {
    return "Sem telefone"
  }

  const clean =
    String(phone)
      .replace("@c.us", "")
      .replace("@lid", "")
      .replace(/\D/g, "")

  if (
    clean.startsWith("55") &&
    clean.length >= 12
  ) {
    const ddd =
      clean.slice(2, 4)

    const part1 =
      clean.length === 13
        ? clean.slice(4, 9)
        : clean.slice(4, 8)

    const part2 =
      clean.length === 13
        ? clean.slice(9)
        : clean.slice(8)

    return `+55 (${ddd}) ${part1}-${part2}`
  }

  return phone
}

function getInitials(
  name: string
) {
  const clean =
    String(name || "Cliente")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()

  const parts =
    clean
      .split(/\s+/)
      .filter(Boolean)

  if (!parts.length) {
    return "CL"
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase()
}

function getStatus(
  status: string
): OrderStatus {
  const s =
    normalizeText(status)

  if (
    s.includes("pago") ||
    s.includes("paid") ||
    s.includes("aprovado") ||
    s.includes("confirmed")
  ) {
    return {
      label:
        "Pago",
      className:
        "status-paid",
      type:
        "paid"
    }
  }

  if (
    s.includes("cancel") ||
    s.includes("cancelado") ||
    s.includes("refunded")
  ) {
    return {
      label:
        "Cancelado",
      className:
        "status-cancelled",
      type:
        "cancelled"
    }
  }

  if (
    s.includes("aguard") ||
    s.includes("pend") ||
    s.includes("pending") ||
    s.includes("waiting")
  ) {
    return {
      label:
        "Aguardando",
      className:
        "status-pending",
      type:
        "pending"
    }
  }

  return {
    label:
      status || "Pendente",
    className:
      "status-pending",
    type:
      "other"
  }
}

function getShippingLabel(
  status?: string,
  method?: string
) {
  const value =
    String(status || method || "")
      .trim()

  if (!value) {
    return "Pendente"
  }

  return value
}

function getPaymentLabel(
  value?: string
) {
  if (!value) {
    return "Não informado"
  }

  const clean =
    normalizeText(value)

  if (clean.includes("pix")) {
    return "Pix"
  }

  if (
    clean.includes("credit") ||
    clean.includes("credito") ||
    clean.includes("crédito")
  ) {
    return "Cartão de crédito"
  }

  if (
    clean.includes("debit") ||
    clean.includes("debito") ||
    clean.includes("débito")
  ) {
    return "Cartão de débito"
  }

  return value
}

// ======================
// COMPONENT
// ======================

export default function Pedidos() {
  const [orders, setOrders] =
    useState<Order[]>([])

  const [search, setSearch] =
    useState("")

  const [filter, setFilter] =
    useState<FilterType>("all")

  const [loading, setLoading] =
    useState(true)

  const [loadingMore, setLoadingMore] =
    useState(false)

  const [page, setPage] =
    useState(1)

  const [hasMore, setHasMore] =
    useState(true)

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null)

  const fetchingRef =
    useRef(false)

  // ======================
  // FETCH
  // ======================

  const loadOrders =
    useCallback(
      async (
        pageNumber = 1,
        append = false,
        silent = false
      ) => {
        if (fetchingRef.current) {
          return
        }

        fetchingRef.current = true

        try {
          if (append) {
            setLoadingMore(true)
          } else if (!silent) {
            setLoading(true)
          }

          const res =
            await fetch(
              `/api/orders?page=${pageNumber}`,
              {
                cache:
                  "no-store",
                headers: {
                  Pragma:
                    "no-cache"
                }
              }
            )

          if (!res.ok) {
            throw new Error(
              "Erro API"
            )
          }

          const data =
            await res.json()

          if (
            !Array.isArray(data)
          ) {
            throw new Error(
              "Resposta inválida"
            )
          }

          if (
            pageNumber === 1
          ) {
            setHasMore(true)
          }

          if (
            data.length === 0
          ) {
            setHasMore(false)

            if (!append) {
              setOrders([])
            }

            return
          }

          setOrders((prev) => {
            if (!append) {
              return data
            }

            const existing =
              new Set(
                prev.map(
                  (o) => o.id
                )
              )

            const filtered =
              data.filter(
                (o) =>
                  !existing.has(o.id)
              )

            return [
              ...prev,
              ...filtered
            ]
          })

          setLastUpdated(
            new Date()
          )

        } catch (err) {
          console.error(
            "❌ erro pedidos:",
            err
          )
        } finally {
          setLoading(false)
          setLoadingMore(false)
          fetchingRef.current = false
        }
      },
      []
    )

  // ======================
  // INIT
  // ======================

  useEffect(() => {
    loadOrders(1)
  }, [loadOrders])

  // ======================
  // AUTO REFRESH
  // ======================

  useEffect(() => {
    const interval =
      setInterval(() => {
        if (
          !fetchingRef.current
        ) {
          loadOrders(
            1,
            false,
            true
          )

          setPage(1)
        }
      }, 15000)

    return () =>
      clearInterval(interval)
  }, [loadOrders])

  // ======================
  // SCROLL
  // ======================

  useEffect(() => {
    function handleScroll() {
      const isNearBottom =
        window.innerHeight +
          window.scrollY >=
        document.body.offsetHeight - 240

      if (
        isNearBottom &&
        hasMore &&
        !loadingMore &&
        !fetchingRef.current
      ) {
        const next =
          page + 1

        setPage(next)

        loadOrders(
          next,
          true
        )
      }
    }

    window.addEventListener(
      "scroll",
      handleScroll
    )

    return () =>
      window.removeEventListener(
        "scroll",
        handleScroll
      )
  }, [
    page,
    hasMore,
    loadingMore,
    loadOrders
  ])

  // ======================
  // FILTER
  // ======================

  const filteredOrders =
    useMemo(() => {
      const query =
        normalizeText(search)

      return orders.filter(
        (order) => {
          const status =
            getStatus(
              order.status
            )

          const searchTarget =
            normalizeText(
              `${order.customer || ""} ${order.phone || ""} ${order.id}`
            )

          const matchSearch =
            !query ||
            searchTarget.includes(query)

          const matchFilter =
            filter === "all"
              ? true
              : status.type === filter

          return (
            matchSearch &&
            matchFilter
          )
        }
      )
    }, [
      orders,
      search,
      filter
    ])

  // ======================
  // KPIS
  // ======================

  const summary =
    useMemo(() => {
      const paidOrders =
        orders.filter(
          order =>
            getStatus(order.status)
              .type === "paid"
        )

      const pendingOrders =
        orders.filter(
          order =>
            getStatus(order.status)
              .type === "pending"
        )

      const cancelledOrders =
        orders.filter(
          order =>
            getStatus(order.status)
              .type === "cancelled"
        )

      const totalRevenue =
        paidOrders.reduce(
          (acc, order) =>
            acc + Number(order.total || 0),
          0
        )

      const averageTicket =
        paidOrders.length
          ? totalRevenue / paidOrders.length
          : 0

      return {
        totalRevenue,
        averageTicket,
        total:
          orders.length,
        paid:
          paidOrders.length,
        pending:
          pendingOrders.length,
        cancelled:
          cancelledOrders.length
      }
    }, [orders])

  // ======================
  // LOADING
  // ======================

  if (
    loading &&
    orders.length === 0
  ) {
    return (
      <div className={styles["loading-page"]}>
        <div className={styles["loading-card"]}>
          <span className={styles["loading-spinner"]} />
          <strong>
            Carregando pedidos...
          </strong>
          <p>
            Buscando as informações mais recentes da loja.
          </p>
        </div>
      </div>
    )
  }

  // ======================
  // RENDER
  // ======================

  return (
    <div className={styles["pedidos-page"]}>
      {/* HEADER */}
      <div className={styles["pedidos-hero"]}>
        <div>
          <span className={styles["eyebrow"]}>
            Gestão de vendas
          </span>

          <h1>
            Pedidos
          </h1>

          <p>
            Acompanhe pagamentos, envios, clientes e faturamento em tempo real.
          </p>
        </div>

        <button
          type="button"
          className={styles["refresh-button"]}
          onClick={() => {
            setPage(1)
            loadOrders(1)
          }}
          disabled={loading}
        >
          {loading
            ? "Atualizando..."
            : "Atualizar"}
        </button>
      </div>

      {/* KPIS */}
      <div className={styles["orders-kpis"]}>
        <div className={styles.kpi}>
          <span>
            Faturamento pago
          </span>

          <strong>
            {formatCurrency(
              summary.totalRevenue
            )}
          </strong>

          <small>
            Soma dos pedidos pagos
          </small>
        </div>

        <div className={styles.kpi}>
          <span>
            Pedidos
          </span>

          <strong>
            {summary.total}
          </strong>

          <small>
            Total carregado
          </small>
        </div>

        <div className={styles.kpi}>
          <span>
            Ticket médio
          </span>

          <strong>
            {formatCurrency(
              summary.averageTicket
            )}
          </strong>

          <small>
            Média dos pagos
          </small>
        </div>

        <div className={styles.kpi}>
          <span>
            Pendentes
          </span>

          <strong>
            {summary.pending}
          </strong>

          <small>
            Aguardando pagamento
          </small>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className={styles["orders-toolbar"]}>
        <div className={styles["search-box"]}>
          <span>
            🔎
          </span>

          <input
            placeholder="Buscar por cliente, telefone ou pedido..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />
        </div>

        <div className={styles["filter-group"]}>
          <button
            type="button"
            className={
              filter === "all"
                ? styles.active
                : ""
            }
            onClick={() =>
              setFilter("all")
            }
          >
            Todos
          </button>

          <button
            type="button"
            className={
              filter === "paid"
                ? styles.active
                : ""
            }
            onClick={() =>
              setFilter("paid")
            }
          >
            Pagos
          </button>

          <button
            type="button"
            className={
              filter === "pending"
                ? styles.active
                : ""
            }
            onClick={() =>
              setFilter("pending")
            }
          >
            Pendentes
          </button>

          <button
            type="button"
            className={
              filter === "cancelled"
                ? styles.active
                : ""
            }
            onClick={() =>
              setFilter("cancelled")
            }
          >
            Cancelados
          </button>
        </div>
      </div>

      <div className={styles["orders-meta"]}>
        <span>
          {filteredOrders.length} pedido{filteredOrders.length === 1 ? "" : "s"} encontrado{filteredOrders.length === 1 ? "" : "s"}
        </span>

        {lastUpdated && (
          <span>
            Atualizado às {formatTime(lastUpdated.toISOString())}
          </span>
        )}
      </div>

      {/* TABLE */}
      <div className={styles["orders-table"]}>
        <div className={`${styles["orders-row"]} ${styles.header}`}>
          <div>
            Pedido
          </div>

          <div>
            Cliente
          </div>

          <div>
            Status
          </div>

          <div>
            Envio
          </div>

          <div>
            Pagamento
          </div>

          <div>
            Total
          </div>

          <div>
            Data
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className={styles["orders-empty"]}>
            <div>
              🛍️
            </div>

            <strong>
              Nenhum pedido encontrado
            </strong>

            <p>
              Ajuste a busca ou escolha outro filtro.
            </p>
          </div>
        ) : (
          filteredOrders.map(
            (order) => {
              const status =
                getStatus(
                  order.status
                )

              return (
                <div
                  key={order.id}
                  className={styles["orders-row"]}
                >
                  <div className={styles["order-id"]}>
                    #{order.id}
                  </div>

                  <div className={styles["customer-cell"]}>
                    <div className={styles.avatar}>
                      {getInitials(
                        order.customer ||
                          "Cliente"
                      )}
                    </div>

                    <div>
                      <strong>
                        {order.customer ||
                          "Cliente"}
                      </strong>

                      <span>
                        {formatPhone(
                          order.phone
                        )}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`
                        ${styles["order-status"]}
                        ${styles[status.className]}
                      `}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className={styles["muted-cell"]}>
                    {getShippingLabel(
                      order.shipping_status,
                      order.shipping_method
                    )}
                  </div>

                  <div className={styles["muted-cell"]}>
                    {getPaymentLabel(
                      order.payment_method
                    )}
                  </div>

                  <div className={styles["total-cell"]}>
                    {formatCurrency(
                      order.total
                    )}
                  </div>

                  <div className={styles["date-cell"]}>
                    {formatDate(
                      order.date
                    )}
                  </div>
                </div>
              )
            }
          )
        )}
      </div>

      {/* LOAD MORE */}
      <div className={styles["load-footer"]}>
        {loadingMore && (
          <div className={styles["loading-more"]}>
            <span className={styles["loading-spinner"]} />
            Carregando mais pedidos...
          </div>
        )}

        {!hasMore &&
          orders.length > 0 && (
            <div className={styles["end-message"]}>
              Todos os pedidos carregados.
            </div>
          )}
      </div>
    </div>
  )
}
