"use client"

import { useEffect, useState } from "react"
import "../styles/numeros.css"

type Store = {
  id: string
  name: string
  status: "online" | "offline"
  phone_number_id: string
}

const API = "https://api.modapink.phand.com.br"

export default function Numeros() {
  const [stores, setStores] = useState<Store[]>([])
  const [showModal, setShowModal] = useState(false)

  const [name, setName] = useState("")
  const [phoneId, setPhoneId] = useState("")
  const [token, setToken] = useState("")

  // =======================
  // LOAD
  // =======================
  async function loadStores() {
    const res = await fetch(`${API}/stores`, { cache: "no-store" })
    const data = await res.json()
    setStores(data)
  }

  // =======================
  // CREATE
  // =======================
  async function createStore() {
    await fetch(`${API}/stores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        phone_number_id: phoneId,
        access_token: token
      })
    })

    setShowModal(false)
    setName("")
    setPhoneId("")
    setToken("")

    loadStores()
  }

  // =======================
  // DELETE
  // =======================
  async function removeStore(id: string) {
    await fetch(`${API}/stores/${id}`, {
      method: "DELETE"
    })

    loadStores()
  }

  useEffect(() => {
    loadStores()
  }, [])

  return (
    <div className="numbers-page">

      <div className="numbers-header">
        <h1>Números de WhatsApp</h1>

        <button onClick={() => setShowModal(true)}>
          + Adicionar Número
        </button>
      </div>

      <div className="numbers-grid">
        {stores.length === 0 && (
          <p className="empty">Nenhum número conectado</p>
        )}

        {stores.map((s) => (
          <div key={s.id} className="card">

            <div className="card-title">{s.name}</div>

            <div className="card-id">
              {s.phone_number_id}
            </div>

            <div className="status online">
              🟢 Online
            </div>

            <button onClick={() => removeStore(s.id)}>
              Remover
            </button>

          </div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal">
          <div className="modal-box">

            <h2>Adicionar Número</h2>

            <input
              placeholder="Nome (ex: Vendas)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              placeholder="Phone Number ID (Meta)"
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
            />

            <input
              placeholder="Access Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />

            <button onClick={createStore}>
              Salvar
            </button>

            <button onClick={() => setShowModal(false)}>
              Cancelar
            </button>

          </div>
        </div>
      )}

    </div>
  )
}