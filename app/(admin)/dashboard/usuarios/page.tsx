"use client"

import { useEffect, useState } from "react"

import styles from "../styles/users.module.css"

import { createClient } from "@/lib/supabase/client"

type UserRole = "admin" | "agent" | "user"

type User = {
  id: string
  name: string
  email: string
  role: UserRole
}

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  agent: "Atendente",
  user: "Usuário"
}

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null)

  const [editForm, setEditForm] = useState<{
    name: string
    email: string
    role: UserRole
  }>({
    name: "",
    email: "",
    role: "agent"
  })

  const [createForm, setCreateForm] = useState<{
    name: string
    email: string
    role: UserRole
  }>({
    name: "",
    email: "",
    role: "agent"
  })

  const [creating, setCreating] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState("")
  const [currentUserId, setCurrentUserId] = useState("")

  // =========================
  // USER LOGADO
  // =========================
  useEffect(() => {
    const supabase = createClient()

    async function loadCurrentUser() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error || !user) {
        return
      }

      setCurrentUserId(user.id)

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (data) {
        setCurrentUserRole(data.role)
      }
    }

    loadCurrentUser()
  }, [])

  // =========================
  // LOAD USERS
  // =========================
  async function loadUsers() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role")
      .order("name", { ascending: true })

    if (error) {
      console.error("Erro ao carregar usuários:", error)
      alert("Erro ao carregar usuários")
      return
    }

    if (data) {
      setUsers(data as User[])
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // =========================
  // EDIT
  // =========================
  function startEdit(user: User) {
    setEditingId(user.id)

    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "agent"
    })
  }

  function cancelEdit() {
    setEditingId(null)

    setEditForm({
      name: "",
      email: "",
      role: "agent"
    })
  }

  async function saveEdit(id: string) {
    const supabase = createClient()

    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (!editForm.name.trim() || !editForm.email.trim()) {
      alert("Preencha nome e e-mail")
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from("profiles")
      .update({
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role
      })
      .eq("id", id)

    setLoading(false)

    if (error) {
      console.error("Erro ao salvar usuário:", error)
      alert("Erro ao salvar usuário")
      return
    }

    setEditingId(null)
    loadUsers()
  }

  // =========================
  // CREATE + SEND PASSWORD LINK
  // =========================
  async function createUser() {
    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (!createForm.email.trim() || !createForm.name.trim()) {
      alert("Preencha nome e e-mail")
      return
    }

    setLoading(true)

    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role
      })
    })

    const result = await res.json()

    setLoading(false)

    if (!res.ok || result.error) {
      alert(result.error || "Erro ao criar usuário")
      return
    }

    alert("Usuário criado e link de senha enviado por e-mail.")

    setCreating(false)

    setCreateForm({
      name: "",
      email: "",
      role: "agent"
    })

    loadUsers()
  }

  // =========================
  // RESEND PASSWORD LINK
  // =========================
  async function resendPasswordLink(user: User) {
    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (!user.email) {
      alert("Usuário sem e-mail cadastrado")
      return
    }

    setSendingInviteId(user.id)

    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user.email
      })
    })

    const result = await res.json()

    setSendingInviteId(null)

    if (!res.ok || result.error) {
      alert(result.error || "Erro ao enviar link")
      return
    }

    alert("Link para criar/redefinir senha enviado por e-mail.")
  }

  // =========================
  // DELETE
  // =========================
  async function deleteUser(id: string) {
    const supabase = createClient()

    if (currentUserRole !== "admin") {
      alert("Sem permissão")
      return
    }

    if (id === currentUserId) {
      alert("Você não pode excluir seu próprio usuário")
      return
    }

    const confirmDelete = confirm("Deseja excluir este usuário?")

    if (!confirmDelete) {
      return
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Erro ao excluir usuário:", error)
      alert("Erro ao excluir usuário")
      return
    }

    loadUsers()
  }

  return (
    <div className={styles["users-page"]}>
      {/* HEADER */}
      <div className={styles["users-header"]}>
        <div>
          <div className={styles["users-title"]}>
            Usuários
          </div>

          <p className={styles["users-subtitle"]}>
            Gerencie administradores, atendentes e usuários do painel.
          </p>
        </div>

        {currentUserRole === "admin" && (
          <button
            className={styles["users-button"]}
            onClick={() => setCreating(true)}
          >
            + Novo usuário
          </button>
        )}
      </div>

      {/* CREATE */}
      {creating && currentUserRole === "admin" && (
        <div className={styles["users-create"]}>
          <input
            className={styles["users-input"]}
            placeholder="Nome"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                name: e.target.value
              })
            }
          />

          <input
            className={styles["users-input"]}
            placeholder="E-mail"
            type="email"
            value={createForm.email}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                email: e.target.value
              })
            }
          />

          <select
            className={styles["users-select"]}
            value={createForm.role}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                role: e.target.value as UserRole
              })
            }
          >
            <option value="admin">
              Administrador
            </option>

            <option value="agent">
              Atendente
            </option>

            <option value="user">
              Usuário
            </option>
          </select>

          <button
            className={styles["users-save"]}
            onClick={createUser}
            disabled={loading}
          >
            {loading ? "Criando..." : "Criar e enviar link"}
          </button>

          <button
            className={styles["users-cancel"]}
            onClick={() => setCreating(false)}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className={styles["users-table"]}>
        <div className={`${styles["users-row"]} ${styles.header}`}>
          <div>Nome</div>
          <div>E-mail</div>
          <div>Cargo</div>
          <div>Ações</div>
        </div>

        {users.map((u) => (
          <div
            key={u.id}
            className={styles["users-row"]}
          >
            <div>
              {editingId === u.id ? (
                <input
                  className={styles["users-input"]}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      name: e.target.value
                    })
                  }
                />
              ) : (
                u.name || "-"
              )}
            </div>

            <div>
              {editingId === u.id ? (
                <input
                  className={styles["users-input"]}
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      email: e.target.value
                    })
                  }
                />
              ) : (
                u.email || "-"
              )}
            </div>

            <div>
              {editingId === u.id ? (
                <select
                  className={styles["users-select"]}
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      role: e.target.value as UserRole
                    })
                  }
                >
                  <option value="admin">
                    Administrador
                  </option>

                  <option value="agent">
                    Atendente
                  </option>

                  <option value="user">
                    Usuário
                  </option>
                </select>
              ) : (
                roleLabels[u.role] || u.role
              )}
            </div>

            <div className={styles["users-actions"]}>
              {currentUserRole === "admin" && (
                editingId === u.id ? (
                  <>
                    <button
                      className={styles["users-save"]}
                      onClick={() => saveEdit(u.id)}
                      disabled={loading}
                    >
                      Salvar
                    </button>

                    <button
                      className={styles["users-cancel"]}
                      onClick={cancelEdit}
                      disabled={loading}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={styles["users-edit"]}
                      onClick={() => startEdit(u)}
                    >
                      Editar
                    </button>

                    <button
                      className={styles["users-link"]}
                      onClick={() => resendPasswordLink(u)}
                      disabled={sendingInviteId === u.id}
                    >
                      {sendingInviteId === u.id
                        ? "Enviando..."
                        : "Enviar link"}
                    </button>

                    <button
                      className={styles["users-delete"]}
                      onClick={() => deleteUser(u.id)}
                      disabled={u.id === currentUserId}
                    >
                      Excluir
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className={styles["users-empty"]}>
            Nenhum usuário cadastrado ainda.
          </div>
        )}
      </div>
    </div>
  )
}