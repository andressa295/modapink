"use client"

import { useEffect, useMemo, useState } from "react"
import "../styles/pedidos.css"

type Order = {
  id: number
  customer: string
  phone?: string
  status: string
  shipping?: string
  total: number
  date: string
  payment_method?: string
  shipping_method?: string
}

export default function Pedidos() {

  const [orders, setOrders] = useState<Order[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // 🚀 FETCH COM PAGINAÇÃO
  async function loadOrders(pageNumber = 1, append = false) {
    try {
      const res = await fetch(`/api/orders?page=${pageNumber}`)
      const data = await res.json()

      if (!data.length) {
        setHasMore(false)
        return
      }

      setOrders(prev => append ? [...prev, ...data] : data)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders(1)
  }, [])

  // 🔥 AUTO REFRESH (tempo real leve)
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders(1)
    }, 10000) // 10s

    return () => clearInterval(interval)
  }, [])

  // 🔥 SCROLL INFINITO
  useEffect(() => {
    function handleScroll() {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        hasMore &&
        !loading
      ) {
        const nextPage = page + 1
        setPage(nextPage)
        loadOrders(nextPage, true)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [page, hasMore, loading])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        order.customer?.toLowerCase().includes(search.toLowerCase()) ||
        order.id?.toString().includes(search)

      const matchFilter =
        filter === "all" ? true : order.status === filter

      return matchSearch && matchFilter
    })
  }, [orders, search, filter])

  // 🔥 STATUS PAGAMENTO
  const getStatus = (status: string) => {
    switch (status) {
      case "paid":
      case "authorized":
        return { label: "Pago", className: "status-paid" }
      case "pending":
        return { label: "Pendente", className: "status-pending" }
      case "cancelled":
        return { label: "Cancelado", className: "status-cancelled" }
      case "refunded":
        return { label: "Reembolsado", className: "status-cancelled" }
      default:
        return { label: "Em análise", className: "status-pending" }
    }
  }

  // 🔥 ENVIO COMPLETO
  const getShipping = (method?: string, status?: string) => {
    if (!method) return "Não informado"

    if (method.toLowerCase().includes("retirada")) {
      return "Retirada na loja"
    }

    if (method.toLowerCase().includes("correios")) {
      return "Correios"
    }

    if (method.toLowerCase().includes("transportadora")) {
      return "Transportadora"
    }

    return method
  }

  const formatCurrency = (value: number) =>
    value?.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    })

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR")

  const totalRevenue = useMemo(() => {
    return orders.reduce((acc, o) => acc + (o.total || 0), 0)
  }, [orders])

  if (loading && orders.length === 0) {
    return <div className="loading">Carregando pedidos...</div>
  }

  return (
    <div className="pedidos-page">

      <div className="pedidos-header">
        <div className="pedidos-title">
          Pedidos ({orders.length})
        </div>

        <div className="pedidos-actions">
          <input
            placeholder="Buscar cliente ou pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="paid">Pagos</option>
            <option value="pending">Pendentes</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      <div className="orders-kpis">
        <div className="kpi">
          <span>Faturamento</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
        </div>
      </div>

      <div className="orders-table">

        <div className="orders-row header">
          <div>Pedido</div>
          <div>Cliente</div>
          <div>Status</div>
          <div>Envio</div>
          <div>Total</div>
          <div>Data</div>
        </div>

        {filteredOrders.map((order) => {
          const status = getStatus(order.status)

          return (
            <div key={order.id} className="orders-row">

              <div>#{order.id}</div>

              <div>
                <strong>{order.customer}</strong>
                {order.phone && <span>{order.phone}</span>}
              </div>

              <div>
                <span className={`order-status ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <div>
                {getShipping(order.shipping_method, order.shipping)}
              </div>

              <div>{formatCurrency(order.total)}</div>
              <div>{formatDate(order.date)}</div>

            </div>
          )
        })}

      </div>

      {loading && <div className="loading-more">Carregando mais...</div>}

    </div>
  )
}