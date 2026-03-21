"use client"

import { useEffect, useState } from "react"
import "./AutomationsUsage.css"
import { supabase } from "@/lib/supabase/client"

type Automation = {
  id: string
  name: string
  uses: number
}

export default function AutomationsUsage() {

  const [automations, setAutomations] = useState<Automation[]>([])

  useEffect(() => {
    async function loadAutomations() {

      const { data } = await supabase
        .from("automations")
        .select("id, name, uses")
        .order("uses", { ascending: false })
        .limit(5)

      if (!data) return

      setAutomations(data)
    }

    loadAutomations()
  }, [])

  return (

    <div className="dashboard-card">

      <h3>Automações mais usadas</h3>

      <div className="automation-list">

        {automations.length === 0 && (
          <p className="empty">
            Nenhuma automação ainda
          </p>
        )}

        {automations.map((item, index) => (

          <div key={item.id} className="automation-item">

            <div className="automation-left">
              <span className="rank">#{index + 1}</span>
              <span className="name">{item.name}</span>
            </div>

            <strong className="uses">
              {item.uses}
            </strong>

          </div>

        ))}

      </div>

    </div>

  )
}