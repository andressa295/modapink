"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthLinkGate } from "./auth-link-gate";
import { DemoProvider } from "../lib/demo-store";

export function ClientApplicationProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/portal-confeccao" || pathname === "/portal-confeccao/") return children;
  return <AuthLinkGate><DemoProvider>{children}</DemoProvider></AuthLinkGate>;
}
