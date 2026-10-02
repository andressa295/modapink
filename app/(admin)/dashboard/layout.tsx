import Sidebar from "./components/Sidebar"
import Topbar from "./components/Topbar"
import BackgroundOrderSync from "./components/BackgroundOrderSync"
import styles from "./styles/admin-layout.module.css"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDashboardAccess } from "@/lib/dashboard-auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getDashboardAccess(await createClient())
  if (!access.role) redirect("/login")
  const role = access.role

  return (
    <div className={styles.layout}>
      {role === "admin" && <BackgroundOrderSync />}

      {/* DESKTOP SIDEBAR */}
      <div className={styles["desktop-sidebar"]}>
        <Sidebar role={role} />
      </div>

      {/* MAIN */}
      <div className={styles.main}>
        {/* TOPBAR */}
        <Topbar role={role} />

        {/* CONTENT */}
        <main className={styles.content}>
          <div className={styles.wrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
