"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"

import {
  BarChart3,
  Box,
  Grid2X2,
  Instagram,
  Menu,
  MessageCircle,
  Phone,
  Settings,
  Smartphone,
  Users,
  X
} from "lucide-react"

import styles from "./mobile-nav.module.css"

const menuItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Grid2X2
  },
  {
    label: "WhatsApp",
    href: "/dashboard/whatsapp",
    icon: MessageCircle,
    highlight: true
  },
  {
    label: "Instagram",
    href: "/dashboard/instagram",
    icon: Instagram
  },
  {
    label: "Números",
    href: "/dashboard/numeros",
    icon: Smartphone
  },
  {
    label: "Usuários",
    href: "/dashboard/usuarios",
    icon: Users
  },
  {
    label: "Pedidos",
    href: "/dashboard/pedidos",
    icon: Box
  },
  {
    label: "Relatórios",
    href: "/dashboard/relatorios",
    icon: BarChart3
  },
  {
    label: "Configurações",
    href: "/dashboard/configuracoes",
    icon: Settings
  }
]

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  function closeMenu() {
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className={styles["mobile-menu-button"]}
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div
          className={styles["mobile-overlay"]}
          onClick={closeMenu}
        />
      )}

      <aside
        className={`${styles["mobile-drawer"]} ${
          open ? styles["drawer-open"] : ""
        }`}
      >
        <div className={styles["mobile-top"]}>
          <div className={styles["mobile-logo"]}>
            <Image
              src="/logo.png"
              alt="Moda Pink"
              width={120}
              height={70}
              priority
            />
          </div>

          <button
            type="button"
            className={styles["mobile-close"]}
            onClick={closeMenu}
            aria-label="Fechar menu"
          >
            <X size={19} />
          </button>
        </div>

        <nav className={styles["mobile-content"]}>
          {menuItems.map((item) => {
            const Icon = item.icon

            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={`${styles["mobile-link"]} ${
                  active ? styles["mobile-link-active"] : ""
                } ${
                  item.highlight ? styles["mobile-link-whatsapp"] : ""
                }`}
              >
                <span className={styles["mobile-link-icon"]}>
                  <Icon size={18} />
                </span>

                <span>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className={styles["mobile-footer"]} />
      </aside>
    </>
  )
}