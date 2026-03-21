"use client"

import { useEffect, useState } from "react"
import "../styles/users.css"
import { supabase } from "@/lib/supabase/client"

type User = {
  id: string
  name: string
  email: string
  role: string
}

export default function Usuarios() {

  const [users, setUsers] = useState<User[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "agent"
  })

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "agent"
  })

  const [creating, setCreating] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState("")
  const [currentUserId, setCurrentUserId] = useState("")

  // 🔐 USER LOGADO
  useEffect(() => {
    async function loadCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setCurrentUserId(user.id)

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data) setCurrentUserRole(data.role)
    }

    loadCurrentUser()
  }, [])

  // 📦 USERS
  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, role")

    if (data) setUsers(data)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // ✏️ EDIT
  function startEdit(user: User) {
    setEditingId(user.id)

    setEditForm({
      name: user.name || "",
      email: user.email,
      role: user.role
    })
  }

  async function saveEdit(id: string) {

    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    const { error } = await supabase
      .from("profiles")
      .update(editForm)
      .eq("id", id)

    if (error) {
      alert("Erro ao salvar")
      return
    }

    setEditingId(null)
    loadUsers()
  }

  // ➕ CREATE (AGORA CORRETO)
  async function createUser() {

    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (!createForm.email || !createForm.name) {
      alert("Preencha todos os campos")
      return
    }

    const res = await fetch("/api/users/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(createForm)
})

    const result = await res.json()

    if (result.error) {
      alert(result.error)
      return
    }

    setCreating(false)
    setCreateForm({ name: "", email: "", role: "agent" })

    loadUsers()
  }

  // 🗑️ DELETE
  async function deleteUser(id: string) {

    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (id === currentUserId) {
      alert("Você não pode excluir seu próprio usuário")
      return
    }

    const confirmDelete = confirm("Deseja excluir este usuário?")
    if (!confirmDelete) return

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id)

    if (error) {
      alert("Erro ao excluir")
      return
    }

    loadUsers()
  }

  return (

    <div>

      <div className="users-header">
        <div className="users-title">Usuários</div>

        {currentUserRole === "admin" && (
          <button
            className="users-button"
            onClick={() => setCreating(true)}
          >
            + Novo usuário
          </button>
        )}
      </div>

      {/* CREATE */}
      {creating && currentUserRole === "admin" && (
        <div className="users-create">

          <input
            placeholder="Nome"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm({ ...createForm, name: e.target.value })
            }
          />

          <input
            placeholder="Email"
            value={createForm.email}
            onChange={(e) =>
              setCreateForm({ ...createForm, email: e.target.value })
            }
          />

          <select
            value={createForm.role}
            onChange={(e) =>
              setCreateForm({ ...createForm, role: e.target.value })
            }
          >
            <option value="admin">Admin</option>
            <option value="agent">Atendente</option>
          </select>

          <button onClick={createUser}>
            Salvar
          </button>

        </div>
      )}

      {/* TABLE */}
      <div className="users-table">

        <div className="users-row header">
          <div>Nome</div>
          <div>Email</div>
          <div>Cargo</div>
          <div></div>
        </div>

        {users.map((u) => (

          <div key={u.id} className="users-row">

            <div>
              {editingId === u.id ? (
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              ) : u.name}
            </div>

            <div>
              {editingId === u.id ? (
                <input
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              ) : u.email}
            </div>

            <div>
              {editingId === u.id ? (
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Atendente</option>
                </select>
              ) : u.role}
            </div>

            <div className="users-actions">

              {currentUserRole === "admin" && (
                editingId === u.id ? (
                  <button onClick={() => saveEdit(u.id)}>
                    Salvar
                  </button>
                ) : (
                  <>
                    <button onClick={() => startEdit(u)}>
                      Editar
                    </button>

                    <button
                      className="delete"
                      onClick={() => deleteUser(u.id)}
                    >
                      Excluir
                    </button>
                  </>
                )
              )}

            </div>

          </div>

        ))}

      </div>

    </div>
  )
}