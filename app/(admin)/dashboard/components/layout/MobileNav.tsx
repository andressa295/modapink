"use client"

import { useState } from "react"
import "./mobile-nav.module.css"
import { Menu, X } from "lucide-react"

export default function MobileNav({ children }: { children: React.ReactNode }) {

  const [open, setOpen] = useState(false)

  return (
    <>
      {/* BOTÃO MENU */}
      <button
        className="mobile-menu-button"
        onClick={() => setOpen(true)}
      >
        <Menu size={22} />
      </button>

      {/* OVERLAY */}
      {open && (
        <div
          className="mobile-overlay"
          onClick={() => setOpen(false)}
        />
      )}

      {/* MENU LATERAL */}
      <div className={`mobile-drawer ${open ? "open" : ""}`}>

        <div className="mobile-header">
          <span>Menu</span>

          <button onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="mobile-content">
          {children}
        </div>

      </div>
    </>
  )
}