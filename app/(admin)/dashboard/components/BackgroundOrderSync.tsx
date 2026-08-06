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

    window.sessionStorage.setItem(
      SYNC_KEY,
      String(Date.now())
    )

    const controller = new AbortController()

    const run = async () => {
      try {
        await fetch("/api/orders?page=1", {
          cache: "no-store",
          signal: controller.signal
        })

        await Promise.allSettled(
          PRELOAD_RANGES.map((range) => {
            return fetch(
              `/api/reports/financial?range=${range}`,
              { signal: controller.signal }
            )
          })
        )
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

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(
          () => void run(),
          { timeout: 1500 }
        )

        return () => window.cancelIdleCallback(idleId)
      }

      const timer = window.setTimeout(
        () => void run(),
        500
      )

      return () => window.clearTimeout(timer)
    }

    const cancelSchedule = schedule()

    return () => {
      cancelSchedule()
      controller.abort()
    }
  }, [])

  return null
}
