// app/(admin)/dashboard/components/DebugSupabase.tsx

"use client"

import { useEffect, useState } from "react"

import { createClient } from "@/lib/supabase/client"

export default function DebugSupabase() {
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    async function test() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .limit(5)

      setResult({
        data,
        error
      })

      console.log("DEBUG SUPABASE:", {
        data,
        error
      })
    }

    test()
  }, [])

  return (
    <pre
      style={{
        background: "#111",
        color: "#0f0",
        padding: 20,
        borderRadius: 12,
        overflow: "auto",
        maxHeight: 400
      }}
    >
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}