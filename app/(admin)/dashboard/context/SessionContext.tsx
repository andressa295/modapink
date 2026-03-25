"use client"

import { createContext, useContext, useState } from "react"

type SessionContextType = {
  activeSession: string | null
  setActiveSession: (phone: string) => void
}

const SessionContext = createContext<SessionContextType | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<string | null>(null)

  return (
    <SessionContext.Provider value={{ activeSession, setActiveSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error("useSession must be used within SessionProvider")
  }

  return context
}