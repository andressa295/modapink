"use client"

import {

  useEffect,
  useMemo,
  useState,
  useRef

} from "react"

import "../styles/pedidos.module.css"

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

// ======================
// COMPONENT
// ======================
export default function Pedidos() {

  const [orders, setOrders] =
    useState<Order[]>([])

  const [search, setSearch] =
    useState("")

  const [filter, setFilter] =
    useState("all")

  const [loading, setLoading] =
    useState(true)

  const [loadingMore, setLoadingMore] =
    useState(false)

  const [page, setPage] =
    useState(1)

  const [hasMore, setHasMore] =
    useState(true)

  const fetchingRef =
    useRef(false)

  // ======================
  // FETCH
  // ======================
  async function loadOrders(

    pageNumber = 1,

    append = false

  ) {

    if (fetchingRef.current)
      return

    fetchingRef.current = true

    try {

      if (append)
        setLoadingMore(true)

      else
        setLoading(true)

      const res =
        await fetch(

          `/api/orders?page=${pageNumber}`

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

        data.length === 0

      ) {

        setHasMore(false)

        return
      }

      setOrders((prev) => {

        if (!append)
          return data

        // evita duplicação
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
  }

  // ======================
  // INIT
  // ======================
  useEffect(() => {

    loadOrders(1)

  }, [])

  // ======================
  // AUTO REFRESH
  // ======================
  useEffect(() => {

    const interval =
      setInterval(() => {

        // atualiza silenciosamente
        if (
          !fetchingRef.current
        ) {

          loadOrders(1)
        }

      }, 15000)

    return () =>
      clearInterval(interval)

  }, [])

  // ======================
  // SCROLL
  // ======================
  useEffect(() => {

    function handleScroll() {

      if (

        window.innerHeight +

        window.scrollY

        >=

        document.body.offsetHeight - 200

        &&

        hasMore

        &&

        !loadingMore

        &&

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
    loadingMore

  ])

  // ======================
  // FILTER
  // ======================
  const filteredOrders =
    useMemo(() => {

      return orders.filter(
        (order) => {

          const matchSearch =

            order.customer
              ?.toLowerCase()
              .includes(
                search.toLowerCase()
              )

            ||

            order.id
              ?.toString()
              .includes(search)

          const matchFilter =

            filter === "all"

              ? true

              : order.status === filter

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
  // STATUS
  // ======================
  function getStatus(
    status: string
  ) {

    const s =
      String(status || "")
        .toLowerCase()

    if (

      s.includes("pago")

    ) {

      return {

        label: "Pago",

        className:
          "status-paid"

      }
    }

    if (

      s.includes("cancel")

    ) {

      return {

        label: "Cancelado",

        className:
          "status-cancelled"

      }
    }

    if (

      s.includes("aguard")

    ) {

      return {

        label:
          "Aguardando",

        className:
          "status-pending"

      }
    }

    return {

      label:
        status || "Pendente",

      className:
        "status-pending"

    }
  }

  // ======================
  // SHIPPING
  // ======================
  function getShipping(
    status?: string
  ) {

    if (!status)
      return "Pendente"

    return status
  }

  // ======================
  // FORMATTERS
  // ======================
  function formatCurrency(
    value: number
  ) {

    return value
      ?.toLocaleString(

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

    return new Date(date)
      .toLocaleDateString(
        "pt-BR"
      )
  }

  // ======================
  // KPIS
  // ======================
  const totalRevenue =
    useMemo(() => {

      return orders.reduce(

        (acc, o) =>

          acc + (o.total || 0),

        0

      )

    }, [orders])

  // ======================
  // LOADING
  // ======================
  if (

    loading

    &&

    orders.length === 0

  ) {

    return (

      <div className="loading">

        Carregando pedidos...

      </div>
    )
  }

  // ======================
  // RENDER
  // ======================
  return (

    <div className="pedidos-page">

      {/* HEADER */}
      <div className="pedidos-header">

        <div className="pedidos-title">

          Pedidos ({orders.length})

        </div>

        <div className="pedidos-actions">

          <input

            placeholder="Buscar cliente ou pedido..."

            value={search}

            onChange={(e) =>

              setSearch(
                e.target.value
              )

            }

          />

          <select

            value={filter}

            onChange={(e) =>

              setFilter(
                e.target.value
              )

            }

          >

            <option value="all">
              Todos
            </option>

            <option value="Pago">
              Pagos
            </option>

            <option value="Aguardando pagamento">
              Pendentes
            </option>

            <option value="Cancelado">
              Cancelados
            </option>

          </select>

        </div>

      </div>

      {/* KPI */}
      <div className="orders-kpis">

        <div className="kpi">

          <span>
            Faturamento
          </span>

          <strong>

            {formatCurrency(
              totalRevenue
            )}

          </strong>

        </div>

      </div>

      {/* TABLE */}
      <div className="orders-table">

        <div className="orders-row header">

          <div>Pedido</div>

          <div>Cliente</div>

          <div>Status</div>

          <div>Envio</div>

          <div>Total</div>

          <div>Data</div>

        </div>

        {filteredOrders.map(
          (order) => {

            const status =
              getStatus(
                order.status
              )

            return (

              <div

                key={order.id}

                className="orders-row"

              >

                <div>

                  #{order.id}

                </div>

                <div>

                  <strong>

                    {order.customer ||
                      "Cliente"}

                  </strong>

                  <span>

                    {order.phone ||
                      "Sem telefone"}

                  </span>

                </div>

                <div>

                  <span

                    className={`order-status ${status.className}`}

                  >

                    {status.label}

                  </span>

                </div>

                <div>

                  {getShipping(
                    order.shipping_status
                  )}

                </div>

                <div>

                  {formatCurrency(
                    order.total
                  )}

                </div>

                <div>

                  {formatDate(
                    order.date
                  )}

                </div>

              </div>
            )
          }
        )}

      </div>

      {/* LOAD MORE */}
      {loadingMore && (

        <div className="loading-more">

          Carregando mais pedidos...

        </div>

      )}

    </div>
  )
}