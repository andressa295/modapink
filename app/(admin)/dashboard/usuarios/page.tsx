"use client"

import { useEffect, useState } from "react"

import styles from "../styles/users.module.css"

import { createClient } from "@/lib/supabase/client"

type User = {

  id: string

  name: string

  email: string

  role: string
}

export default function Usuarios() {

  const [

    users,

    setUsers

  ] = useState<User[]>([])

  const [

    editingId,

    setEditingId

  ] = useState<string | null>(null)

  const [

    editForm,

    setEditForm

  ] = useState({

    name: "",

    email: "",

    role: "agent"
  })

  const [

    createForm,

    setCreateForm

  ] = useState({

    name: "",

    email: "",

    role: "agent"
  })

  const [

    creating,

    setCreating

  ] = useState(false)

  const [

    currentUserRole,

    setCurrentUserRole

  ] = useState("")

  const [

    currentUserId,

    setCurrentUserId

  ] = useState("")

  // =========================
  // USER LOGADO
  // =========================
  useEffect(() => {

    const supabase =
      createClient()

    async function loadCurrentUser() {

      const {

        data: { user },

        error

      } = await supabase
        .auth
        .getUser()

      if (
        error ||
        !user
      ) {
        return
      }

      setCurrentUserId(
        user.id
      )

      const {

        data

      } = await supabase

        .from("profiles")

        .select("role")

        .eq(
          "id",
          user.id
        )

        .single()

      if (data) {

        setCurrentUserRole(
          data.role
        )
      }
    }

    loadCurrentUser()

  }, [])

  // =========================
  // LOAD USERS
  // =========================
  async function loadUsers() {

    const supabase =
      createClient()

    const {

      data,

      error

    } = await supabase

      .from("profiles")

      .select(
        "id, name, email, role"
      )

    if (error) {

      console.error(

        "Erro ao carregar usuários:",

        error
      )

      return
    }

    if (data) {

      setUsers(data)
    }
  }

  useEffect(() => {

    loadUsers()

  }, [])

  // =========================
  // EDIT
  // =========================
  function startEdit(user: User) {

    setEditingId(
      user.id
    )

    setEditForm({

      name:
        user.name || "",

      email:
        user.email,

      role:
        user.role
    })
  }

  async function saveEdit(
    id: string
  ) {

    const supabase =
      createClient()

    if (
      currentUserRole !== "admin"
    ) {

      alert(
        "Sem permissão"
      )

      return
    }

    const {

      error

    } = await supabase

      .from("profiles")

      .update(editForm)

      .eq("id", id)

    if (error) {

      alert(
        "Erro ao salvar"
      )

      return
    }

    setEditingId(null)

    loadUsers()
  }

  // =========================
  // CREATE
  // =========================
  async function createUser() {

    if (
      currentUserRole !== "admin"
    ) {

      alert(
        "Sem permissão"
      )

      return
    }

    if (
      !createForm.email ||

      !createForm.name
    ) {

      alert(
        "Preencha todos os campos"
      )

      return
    }

    const res = await fetch(

      "/api/users/create",

      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(
          createForm
        )
      }
    )

    const result =
      await res.json()

    if (result.error) {

      alert(
        result.error
      )

      return
    }

    setCreating(false)

    setCreateForm({

      name: "",

      email: "",

      role: "agent"
    })

    loadUsers()
  }

  // =========================
  // DELETE
  // =========================
  async function deleteUser(
    id: string
  ) {

    const supabase =
      createClient()

    if (
      currentUserRole !== "admin"
    ) {

      alert(
        "Sem permissão"
      )

      return
    }

    if (
      id === currentUserId
    ) {

      alert(
        "Você não pode excluir seu próprio usuário"
      )

      return
    }

    const confirmDelete =
      confirm(
        "Deseja excluir este usuário?"
      )

    if (!confirmDelete) {
      return
    }

    const {

      error

    } = await supabase

      .from("profiles")

      .delete()

      .eq("id", id)

    if (error) {

      alert(
        "Erro ao excluir"
      )

      return
    }

    loadUsers()
  }

  return (

    <div
      className={
        styles["users-page"]
      }
    >

      {/* HEADER */}
      <div
        className={
          styles["users-header"]
        }
      >

        <div
          className={
            styles["users-title"]
          }
        >

          Usuários

        </div>

        {currentUserRole === "admin" && (

          <button

            className={
              styles["users-button"]
            }

            onClick={() =>
              setCreating(true)
            }

          >

            + Novo usuário

          </button>
        )}

      </div>

      {/* CREATE */}
      {creating &&
        currentUserRole === "admin" && (

        <div
          className={
            styles["users-create"]
          }
        >

          <input

            className={
              styles["users-input"]
            }

            placeholder="Nome"

            value={createForm.name}

            onChange={(e) =>

              setCreateForm({

                ...createForm,

                name:
                  e.target.value
              })
            }

          />

          <input

            className={
              styles["users-input"]
            }

            placeholder="Email"

            value={createForm.email}

            onChange={(e) =>

              setCreateForm({

                ...createForm,

                email:
                  e.target.value
              })
            }

          />

          <select

            className={
              styles["users-select"]
            }

            value={createForm.role}

            onChange={(e) =>

              setCreateForm({

                ...createForm,

                role:
                  e.target.value
              })
            }

          >

            <option value="admin">
              Admin
            </option>

            <option value="agent">
              Atendente
            </option>

          </select>

          <button

            className={
              styles["users-save"]
            }

            onClick={createUser}

          >

            Salvar

          </button>

        </div>
      )}

      {/* TABLE */}
      <div
        className={
          styles["users-table"]
        }
      >

        <div
          className={`${

            styles["users-row"]}

            ${styles.header}

          `}
        >

          <div>Nome</div>

          <div>Email</div>

          <div>Cargo</div>

          <div></div>

        </div>

        {users.map((u) => (

          <div

            key={u.id}

            className={
              styles["users-row"]
            }

          >

            <div>

              {editingId === u.id ? (

                <input

                  className={
                    styles["users-input"]
                  }

                  value={editForm.name}

                  onChange={(e) =>

                    setEditForm({

                      ...editForm,

                      name:
                        e.target.value
                    })
                  }

                />

              ) : (
                u.name
              )}

            </div>

            <div>

              {editingId === u.id ? (

                <input

                  className={
                    styles["users-input"]
                  }

                  value={editForm.email}

                  onChange={(e) =>

                    setEditForm({

                      ...editForm,

                      email:
                        e.target.value
                    })
                  }

                />

              ) : (
                u.email
              )}

            </div>

            <div>

              {editingId === u.id ? (

                <select

                  className={
                    styles["users-select"]
                  }

                  value={editForm.role}

                  onChange={(e) =>

                    setEditForm({

                      ...editForm,

                      role:
                        e.target.value
                    })
                  }

                >

                  <option value="admin">
                    Admin
                  </option>

                  <option value="agent">
                    Atendente
                  </option>

                </select>

              ) : (
                u.role
              )}

            </div>

            <div
              className={
                styles["users-actions"]
              }
            >

              {currentUserRole === "admin" && (

                editingId === u.id ? (

                  <button

                    className={
                      styles["users-save"]
                    }

                    onClick={() =>
                      saveEdit(u.id)
                    }

                  >

                    Salvar

                  </button>

                ) : (

                  <>

                    <button

                      className={
                        styles["users-edit"]
                      }

                      onClick={() =>
                        startEdit(u)
                      }

                    >

                      Editar

                    </button>

                    <button

                      className={
                        styles["users-delete"]
                      }

                      onClick={() =>
                        deleteUser(u.id)
                      }

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