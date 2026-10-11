"use client"

import { useEffect, useState } from "react"
import { Check, Mail, Pencil, Plus, Search, ShieldCheck, Trash2, Users, X } from "lucide-react"

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon"

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
  const [search, setSearch] = useState("")
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

  const searchTerm = search.trim().toLocaleLowerCase("pt-BR")
  const visibleUsers = users.filter((user) =>
    [user.name, user.email, roleLabels[user.role] || user.role]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(searchTerm))
  )
  const adminCount = users.filter((user) => user.role === "admin").length
  const chatCount = users.filter((user) => user.role === "agent" || user.role === "user").length

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>GESTÃO DE ACESSOS</span>
          <h1>Usuários</h1>
          <p>Organize sua equipe e os acessos ao painel.</p>
        </div>

        {currentUserRole === "admin" && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setCreating(true)}
            aria-expanded={creating}
            aria-controls="create-user-form"
          >
            <Plus size={15} aria-hidden="true" />
            Novo usuário
          </button>
        )}
      </header>

      <section className={styles.metrics} aria-label="Resumo da equipe">
        <div className={styles.metric}>
          <div><span>Equipe cadastrada</span><Users size={17} aria-hidden="true" /></div>
          <strong>{users.length}</strong>
          <p>Usuários no painel</p>
        </div>
        <div className={styles.metric}>
          <div><span>Administradores</span><ShieldCheck size={17} aria-hidden="true" /></div>
          <strong>{adminCount}</strong>
          <p>Acesso completo</p>
        </div>
        <div className={styles.metric}>
          <div><span>Atendimento</span><WhatsAppIcon size={17} /></div>
          <strong>{chatCount}</strong>
          <p>Acesso somente às conversas</p>
        </div>
      </section>

      {creating && currentUserRole === "admin" && (
        <form
          id="create-user-form"
          className={styles.createForm}
          onSubmit={(event) => {
            event.preventDefault()
            createUser()
          }}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Novo usuário</h2>
              <p>O link para definir a senha será enviado por e-mail.</p>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setCreating(false)}
              disabled={loading}
              aria-label="Fechar cadastro de usuário"
            ><X size={17} aria-hidden="true" /></button>
          </div>
          <div className={styles.formFields}>
            <label className={styles.field}>
              <span>Nome</span>
              <input
                className={styles.input}
                placeholder="Nome completo"
                autoComplete="name"
                value={createForm.name}
                onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>E-mail</span>
              <input
                className={styles.input}
                placeholder="nome@loja.com.br"
                type="email"
                autoComplete="email"
                value={createForm.email}
                onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>Perfil de acesso</span>
              <select
                className={styles.input}
                value={createForm.role}
                onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as UserRole })}
              >
                <option value="admin">Administrador</option>
                <option value="agent">Atendente</option>
                <option value="user">Usuário</option>
              </select>
            </label>
          </div>
          <div className={styles.formFooter}>
            <p>
              {createForm.role === "admin"
                ? "Administrador: acesso a todas as áreas do painel."
                : "Atendentes e usuários: acesso somente às conversas."}
            </p>
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setCreating(false)} disabled={loading}>Cancelar</button>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                <Mail size={14} aria-hidden="true" />
                {loading ? "Criando..." : "Criar e enviar link"}
              </button>
            </div>
          </div>
        </form>
      )}

      <section className={styles.directory} aria-labelledby="users-directory-title">
        <div className={styles.directoryHeader}>
          <div>
            <h2 id="users-directory-title">Sua equipe <span>{users.length}</span></h2>
            <p>Administradores gerenciam o painel. Os demais perfis acessam as conversas.</p>
          </div>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar por nome, e-mail ou perfil"
              placeholder="Buscar na equipe"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Usuário</th>
              <th scope="col">E-mail</th>
              <th scope="col">Perfil de acesso</th>
              <th scope="col" className={styles.actionsHeading}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr key={user.id} className={editingId === user.id ? styles.editingRow : undefined}>
                <td data-label="Usuário">
                  {editingId === user.id ? (
                    <input
                      className={styles.input}
                      aria-label={`Nome de ${user.name || user.email || "usuário"}`}
                      value={editForm.name}
                      onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                    />
                  ) : (
                    <div className={styles.userIdentity}>
                      <span className={styles.avatar} aria-hidden="true">
                        {(user.name || user.email || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-BR")}
                      </span>
                      <div>
                        <strong>{user.name || "Sem nome"}</strong>
                        {user.id === currentUserId && <span className={styles.selfBadge}>Você</span>}
                      </div>
                    </div>
                  )}
                </td>
                <td data-label="E-mail" className={styles.emailCell}>
                  {editingId === user.id ? (
                    <input
                      className={styles.input}
                      type="email"
                      aria-label={`E-mail de ${user.name || user.email || "usuário"}`}
                      value={editForm.email}
                      onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                    />
                  ) : user.email || "Não informado"}
                </td>
                <td data-label="Perfil de acesso">
                  {editingId === user.id ? (
                    <select
                      className={styles.input}
                      aria-label={`Perfil de ${user.name || user.email || "usuário"}`}
                      value={editForm.role}
                      onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}
                    >
                      <option value="admin">Administrador</option>
                      <option value="agent">Atendente</option>
                      <option value="user">Usuário</option>
                    </select>
                  ) : (
                    <div className={styles.roleCell}>
                      <span className={`${styles.roleBadge} ${user.role === "admin" ? styles.adminBadge : ""}`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                      <small>{user.role === "admin" ? "Painel completo" : user.role === "agent" || user.role === "user" ? "Somente conversas" : "Perfil não reconhecido"}</small>
                    </div>
                  )}
                </td>
                <td data-label="Ações">
                  <div className={styles.actions}>
                    {currentUserRole === "admin" && (
                      editingId === user.id ? (
                        <>
                          <button type="button" className={styles.saveButton} onClick={() => saveEdit(user.id)} disabled={loading}>
                            <Check size={14} aria-hidden="true" />Salvar
                          </button>
                          <button type="button" className={styles.secondaryButton} onClick={cancelEdit} disabled={loading}>Cancelar</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className={styles.secondaryButton} onClick={() => startEdit(user)} aria-label={`Editar ${user.name || user.email || "usuário"}`}>
                            <Pencil size={13} aria-hidden="true" />Editar
                          </button>
                          <button type="button" className={styles.secondaryButton} onClick={() => resendPasswordLink(user)} disabled={sendingInviteId === user.id} aria-label={`Enviar link de senha para ${user.name || user.email || "usuário"}`}>
                            <Mail size={13} aria-hidden="true" />{sendingInviteId === user.id ? "Enviando..." : "Enviar link"}
                          </button>
                          <button type="button" className={styles.deleteButton} onClick={() => deleteUser(user.id)} disabled={user.id === currentUserId} aria-label={`Excluir ${user.name || user.email || "usuário"}`} title={user.id === currentUserId ? "Você não pode excluir seu próprio usuário" : "Excluir usuário"}>
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleUsers.length === 0 && (
          <div className={styles.empty}>
            <Users size={24} aria-hidden="true" />
            <strong>{searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado ainda"}</strong>
            <p>{searchTerm ? "Tente buscar por outro nome, e-mail ou perfil." : "Adicione as pessoas que vão trabalhar no painel."}</p>
          </div>
        )}
        {searchTerm && visibleUsers.length > 0 && (
          <div className={styles.resultCount}>{visibleUsers.length} de {users.length} usuários</div>
        )}
      </section>
    </div>
  )
}
