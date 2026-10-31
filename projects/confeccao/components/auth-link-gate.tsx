"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { passwordLinkDestination, readPasswordLink, type PasswordLink } from "../lib/auth-link";
const Context = createContext<PasswordLink | null>(null);
export function AuthLinkGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [link, setLink] = useState<PasswordLink | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const callback = readPasswordLink(url);
    const isPasswordPage = url.pathname === "/auth/recovery" || url.pathname === "/auth/confirm";
    if (callback && !isPasswordPage) {
      const destination = passwordLinkDestination(url);
      if (destination) { window.location.replace(destination); return; }
    }
    setLink(callback); setChecked(true);
  }, []);
  // The data provider must not create the SDK client before callback detection.
  if (!checked) return <div className="loading-state" role="status">Preparando seu acesso…</div>;
  return <Context.Provider value={link}>{children}</Context.Provider>;
}
export function usePasswordLink() { return useContext(Context); }
