"use client"

import { useEffect } from "react"

const SYNC_KEY = "modapink-orders-last-background-sync"
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
        const response = await fetch(
          "/api/orders?page=1&pages=5&sync_only=1",
          {
            cache: "no-store",
            signal: controller.signal
          }
        )

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(
            payload?.error ||
            "Não foi possível sincronizar os pedidos."
          )
        }

        window.sessionStorage.setItem(
          SYNC_KEY,
          String(Date.now())
        )

        await preloadReports()
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return
        }

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
