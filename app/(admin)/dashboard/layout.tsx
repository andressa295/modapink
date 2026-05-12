import Sidebar from "./components/Sidebar"

import Topbar from "./components/Topbar"

import styles from "./styles/admin-layout.module.css"

export default function AdminLayout({

  children,

}: {

  children: React.ReactNode

}) {

  return (

    <div
      className={
        styles.layout
      }
    >

      {/* DESKTOP SIDEBAR */}
      <div
        className={
          styles["desktop-sidebar"]
        }
      >

        <Sidebar />

      </div>

      {/* MAIN */}
      <div
        className={
          styles.main
        }
      >

        {/* TOPBAR */}
        <Topbar />

        {/* CONTENT */}
        <main
          className={
            styles.content
          }
        >

          <div
            className={
              styles.wrapper
            }
          >

            {children}

          </div>

        </main>

      </div>

    </div>
  )
}