"use client"

import { useEffect } from "react"

const SYNC_KEY = "modapink-orders-last-background-sync-v3"
const FINANCIAL_RELOAD_KEY = "modapink-financial-reloaded-after-sync-v3"
const SYNC_ERROR_KEY = "modapink-financial-sync-error-v3"
const SYNC_INTERVAL_MS = 2 * 60 * 1000
const PRELOAD_RANGES = ["today", "7d", "month"] as const

export default function BackgroundOrderSync() {
  useEffect(() => {
    const previousSync = Number(
      window.sessionStorage.getItem(SYNC_KEY) || 0
    )

    if (
      Number.isFinite(previousSync) &&
      Date.now() - previousSync < SYNC_INTERVAL_MS
    ) {
      return
    }

    const controller = new AbortController()

    const preloadReports = () => {
      return Promise.allSettled(
        PRELOAD_RANGES.map((range) => {
          return fetch(
            `/api/reports/financial?range=${range}&refresh=1`,
            {
              cache: "no-store",
              signal: controller.signal
            }
          )
        })
      )
    }

    const run = async () => {
      try {
        window.sessionStorage.removeItem(SYNC_ERROR_KEY)

        const response = await fetch(
          "/api/orders/financial-sync?pages=5",
          {
            cache: "no-store",
            signal: controller.signal
          }
        )

        const payload = await response.json().catch(() => null)

        if (!response.ok || !payload?.ok) {
          const details = payload?.details
            ? ` ${payload.details}`
            : ""

          throw new Error(
            `${payload?.error || "Não foi possível sincronizar os pedidos."}${details}`
          )
        }

        if (!Number(payload.synced)) {
          throw new Error(
            "A sincronização terminou, mas nenhum pedido foi salvo."
          )
        }

        window.sessionStorage.setItem(
          SYNC_KEY,
          String(Date.now())
        )

        await preloadReports()

        const isFinancialPage = window.location.pathname.includes(
          "/dashboard/relatorios"
        )
        const alreadyReloaded = window.sessionStorage.getItem(
          FINANCIAL_RELOAD_KEY
        ) === "1"

        if (isFinancialPage && !alreadyReloaded) {
          window.sessionStorage.setItem(
            FINANCIAL_RELOAD_KEY,
            "1"
          )
          window.location.reload()
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return
        }

        const message = error instanceof Error
          ? error.message
          : String(error)

        window.sessionStorage.setItem(
          SYNC_ERROR_KEY,
          message
        )

        console.warn(
          "Sincronização silenciosa dos pedidos não foi concluída.",
          error
        )
      }
    }

    const timer = window.setTimeout(
      () => void run(),
      350
    )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  return null
}
