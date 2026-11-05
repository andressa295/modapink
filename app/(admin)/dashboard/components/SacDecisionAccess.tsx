"use client"

import { createContext, useContext, type ReactNode } from "react"
import Link from "next/link"
import { SAC_WORKFLOW_UUID } from "@/lib/sac-workflow"

const SacDecisionAccess = createContext(false)

// The authenticated server layout supplies only a feature-availability boolean.
// The destination page and API independently enforce access and conversation RLS.
export function SacDecisionAccessProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <SacDecisionAccess.Provider value={enabled}>{children}</SacDecisionAccess.Provider>
}

export function SacDecisionLink({ conversationId, sessionId, sessionKey, className }: {
  conversationId: string
  sessionId?: string | null
  sessionKey?: string | null
  className?: string
}) {
  const enabled = useContext(SacDecisionAccess)
  if (!enabled || sessionId !== "sac" || sessionKey !== "sac" || !SAC_WORKFLOW_UUID.test(conversationId)) return null
  return <Link className={className} style={{ textDecoration: "none" }} href={`/sac-decisoes?conversation=${encodeURIComponent(conversationId)}`}>
    Conferir resposta do SAC
  </Link>
}
